import { filesystem } from '@neutralinojs/lib';
import opentype from 'opentype.js';
import path from 'path-browserify';
import shellFS from '../tools/shellfs';
import Logger from '../utils/logger';
import { getCacheDir } from '../utils/paths';
import { detectRobloxPath } from './path';

const logger = Logger.withContext('FontColorizer');

/** RGB color values (0-255) */
export interface RGBColor {
	r: number;
	g: number;
	b: number;
}

/** Path to BuilderIcons fonts within Roblox.app */
const BUILDER_ICONS_PATH = 'Contents/Resources/ExtraContent/LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons';

/** Cache directory name for icon color files */
const ICON_COLOR_CACHE_DIR = 'icon-color';

/**
 * Convert a hex color string to RGB values.
 * @param hex - Hex color string (e.g., "#FF5500" or "FF5500")
 * @returns RGB color object
 */
export function hexToRgb(hex: string): RGBColor {
	// Remove # if present
	const cleanHex = hex.replace(/^#/, '');

	if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
		throw new Error(`Invalid hex color: ${hex}`);
	}

	return {
		r: parseInt(cleanHex.substring(0, 2), 16),
		g: parseInt(cleanHex.substring(2, 4), 16),
		b: parseInt(cleanHex.substring(4, 6), 16),
	};
}

/**
 * Convert RGB values to a hex color string.
 * @param color - RGB color object
 * @returns Hex color string with # prefix
 */
export function rgbToHex(color: RGBColor): string {
	const toHex = (n: number) =>
		Math.max(0, Math.min(255, Math.round(n)))
			.toString(16)
			.padStart(2, '0');
	return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/**
 * Create the CPAL (Color Palette) table binary data.
 * @param color - The color to use in the palette
 * @returns ArrayBuffer containing the CPAL table
 */
function createCPALTable(color: RGBColor): ArrayBuffer {
	const buffer = new ArrayBuffer(18);
	const view = new DataView(buffer);

	// Header
	view.setUint16(0, 0, false); // version
	view.setUint16(2, 1, false); // numPaletteEntries
	view.setUint16(4, 1, false); // numPalettes
	view.setUint16(6, 1, false); // numColorRecords
	view.setUint32(8, 14, false); // offsetFirstColorRecord

	// colorRecordIndices
	view.setUint16(12, 0, false); // first palette starts at color record 0

	// Color record (BGRA format)
	view.setUint8(14, color.b); // Blue
	view.setUint8(15, color.g); // Green
	view.setUint8(16, color.r); // Red
	view.setUint8(17, 255); // Alpha

	return buffer;
}

/**
 * Create the COLR (Color) table binary data.
 * @param glyphCount - Total number of glyphs in the font
 * @returns ArrayBuffer containing the COLR table
 */
function createCOLRTable(glyphCount: number): ArrayBuffer {
	const headerSize = 14;
	const baseGlyphRecordSize = 6;
	const layerRecordSize = 4;

	const baseGlyphRecordsSize = glyphCount * baseGlyphRecordSize;
	const layerRecordsSize = glyphCount * layerRecordSize;

	const offsetLayerRecord = headerSize + baseGlyphRecordsSize;
	const totalSize = offsetLayerRecord + layerRecordsSize;

	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);

	// Header
	view.setUint16(0, 0, false); // version
	view.setUint16(2, glyphCount, false); // numBaseGlyphRecords
	view.setUint32(4, headerSize, false); // offsetBaseGlyphRecord
	view.setUint32(8, offsetLayerRecord, false); // offsetLayerRecord
	view.setUint16(12, glyphCount, false); // numLayerRecords

	// BaseGlyphRecords - each glyph maps to one layer
	for (let i = 0; i < glyphCount; i++) {
		const offset = headerSize + i * baseGlyphRecordSize;
		view.setUint16(offset, i, false); // glyphID
		view.setUint16(offset + 2, i, false); // firstLayerIndex
		view.setUint16(offset + 4, 1, false); // numLayers
	}

	// LayerRecords - each layer uses the glyph itself with palette index 0
	for (let i = 0; i < glyphCount; i++) {
		const offset = offsetLayerRecord + i * layerRecordSize;
		view.setUint16(offset, i, false); // glyphID
		view.setUint16(offset + 2, 0, false); // paletteIndex
	}

	return buffer;
}

/**
 * Calculate the checksum for an OpenType table.
 * @param data - Table data as Uint8Array
 * @returns 32-bit checksum
 */
function calculateTableChecksum(data: Uint8Array): number {
	const paddedLength = Math.ceil(data.length / 4) * 4;
	const padded = new Uint8Array(paddedLength);
	padded.set(data);

	let sum = 0;
	const view = new DataView(padded.buffer);
	for (let i = 0; i < paddedLength; i += 4) {
		sum = (sum + view.getUint32(i, false)) >>> 0;
	}
	return sum;
}

/**
 * Calculate the checksum for an entire font file.
 * @param data - Complete font file data
 * @returns 32-bit checksum
 */
function calculateWholeFileChecksum(data: ArrayBuffer): number {
	const paddedLength = Math.ceil(data.byteLength / 4) * 4;
	const padded = new Uint8Array(paddedLength);
	padded.set(new Uint8Array(data));

	let sum = 0;
	const view = new DataView(padded.buffer);
	for (let i = 0; i < paddedLength; i += 4) {
		sum = (sum + view.getUint32(i, false)) >>> 0;
	}
	return sum;
}

/**
 * Inject COLR and CPAL tables into a font file.
 * @param fontData - Original font file data
 * @param color - Color to apply
 * @returns Modified font data with color tables
 */
function injectColorTables(fontData: ArrayBuffer, color: RGBColor): ArrayBuffer {
	const view = new DataView(fontData);

	// Parse the font header
	const sfntVersion = view.getUint32(0, false);
	const numTables = view.getUint16(4, false);

	// Read existing tables
	interface TableEntry {
		tag: string;
		checksum: number;
		offset: number;
		length: number;
	}

	const tables: TableEntry[] = [];
	const tableData: Map<string, Uint8Array> = new Map();

	for (let i = 0; i < numTables; i++) {
		const entryOffset = 12 + i * 16;
		const tag = String.fromCharCode(
			view.getUint8(entryOffset),
			view.getUint8(entryOffset + 1),
			view.getUint8(entryOffset + 2),
			view.getUint8(entryOffset + 3)
		);
		const checksum = view.getUint32(entryOffset + 4, false);
		const offset = view.getUint32(entryOffset + 8, false);
		const length = view.getUint32(entryOffset + 12, false);

		tables.push({ tag, checksum, offset, length });
		tableData.set(tag, new Uint8Array(fontData, offset, length));
	}

	// Parse the font to get glyph count
	let glyphCount = 0;
	try {
		const font = opentype.parse(fontData);
		glyphCount = font.glyphs.length;
	} catch (e) {
		// Fallback: try to get from maxp table
		const maxpData = tableData.get('maxp');
		if (maxpData && maxpData.length >= 6) {
			const maxpView = new DataView(maxpData.buffer, maxpData.byteOffset, maxpData.byteLength);
			glyphCount = maxpView.getUint16(4, false);
		}
		if (glyphCount === 0) {
			glyphCount = 256; // Reasonable default
		}
	}

	// Create COLR and CPAL tables
	const cpalData = new Uint8Array(createCPALTable(color));
	const colrData = new Uint8Array(createCOLRTable(glyphCount));

	// Remove existing COLR/CPAL if present, then add new ones
	const filteredTables = tables.filter((t) => t.tag !== 'COLR' && t.tag !== 'CPAL');
	const newTables = [
		...filteredTables,
		{ tag: 'COLR', checksum: 0, offset: 0, length: colrData.length },
		{ tag: 'CPAL', checksum: 0, offset: 0, length: cpalData.length },
	];

	// Sort tables by tag using binary/ASCII comparison (required by OpenType spec)
	// OpenType requires case-sensitive ASCII ordering where uppercase comes before lowercase
	newTables.sort((a, b) => {
		for (let i = 0; i < 4; i++) {
			const diff = a.tag.charCodeAt(i) - b.tag.charCodeAt(i);
			if (diff !== 0) return diff;
		}
		return 0;
	});

	// Calculate new table directory
	const newNumTables = newTables.length;
	const searchRange = Math.pow(2, Math.floor(Math.log2(newNumTables))) * 16;
	const entrySelector = Math.floor(Math.log2(newNumTables));
	const rangeShift = newNumTables * 16 - searchRange;

	// Calculate offsets
	const headerSize = 12;
	const tableDirectorySize = newNumTables * 16;
	let currentOffset = headerSize + tableDirectorySize;

	// Align to 4-byte boundary
	currentOffset = Math.ceil(currentOffset / 4) * 4;

	const tableOffsets: Map<string, number> = new Map();
	for (const table of newTables) {
		tableOffsets.set(table.tag, currentOffset);
		const data =
			table.tag === 'COLR' ? colrData : table.tag === 'CPAL' ? cpalData : tableData.get(table.tag) || new Uint8Array(0);
		currentOffset += Math.ceil(data.length / 4) * 4;
	}

	// Create output buffer
	const outputBuffer = new ArrayBuffer(currentOffset);
	const outputView = new DataView(outputBuffer);
	const output = new Uint8Array(outputBuffer);

	// Write header
	outputView.setUint32(0, sfntVersion, false);
	outputView.setUint16(4, newNumTables, false);
	outputView.setUint16(6, searchRange, false);
	outputView.setUint16(8, entrySelector, false);
	outputView.setUint16(10, rangeShift, false);

	// Track head table position for checksum adjustment
	let headTableOffset = 0;
	let headTableIndex = -1;
	const headTableLength = tableData.get('head')?.length || 54;

	// Write table directory and data
	for (let i = 0; i < newTables.length; i++) {
		const table = newTables[i];
		let data: Uint8Array;

		if (table.tag === 'COLR') {
			data = colrData;
		} else if (table.tag === 'CPAL') {
			data = cpalData;
		} else if (table.tag === 'head') {
			// Make a copy of head table to modify checkSumAdjustment
			const originalHead = tableData.get(table.tag) || new Uint8Array(0);
			data = new Uint8Array(originalHead.length);
			data.set(originalHead);
			// Set checkSumAdjustment to 0 temporarily (at offset 8 in head table)
			const headView = new DataView(data.buffer, data.byteOffset, data.byteLength);
			headView.setUint32(8, 0, false);
			headTableOffset = tableOffsets.get(table.tag)!;
			headTableIndex = i;
		} else {
			data = tableData.get(table.tag) || new Uint8Array(0);
		}

		const offset = tableOffsets.get(table.tag)!;
		const checksum = calculateTableChecksum(data);

		// Write table directory entry
		const entryOffset = 12 + i * 16;
		for (let j = 0; j < 4; j++) {
			outputView.setUint8(entryOffset + j, table.tag.charCodeAt(j));
		}
		outputView.setUint32(entryOffset + 4, checksum, false);
		outputView.setUint32(entryOffset + 8, offset, false);
		outputView.setUint32(entryOffset + 12, data.length, false);

		// Write table data
		output.set(data, offset);
	}

	// Calculate and set the checkSumAdjustment in the head table
	// The magic number is 0xB1B0AFBA - when subtracting the file checksum, the result should make the whole file checksum equal to this value
	const wholeFileChecksum = calculateWholeFileChecksum(outputBuffer);
	const checkSumAdjustment = (0xb1b0afba - wholeFileChecksum) >>> 0;
	outputView.setUint32(headTableOffset + 8, checkSumAdjustment, false);

	// Recalculate head table checksum and update directory
	const headData = new Uint8Array(outputBuffer, headTableOffset, headTableLength);
	const newHeadChecksum = calculateTableChecksum(headData);
	if (headTableIndex >= 0) {
		outputView.setUint32(12 + headTableIndex * 16 + 4, newHeadChecksum, false);
	}

	return outputBuffer;
}

/**
 * Colorize a font file by adding COLR/CPAL tables.
 * @param inputPath - Path to the input font file
 * @param outputPath - Path to save the colorized font
 * @param color - Color to apply to the font
 */
async function colorizeFont(inputPath: string, outputPath: string, color: RGBColor): Promise<void> {
	logger.info(`Colorizing font: ${inputPath} -> ${outputPath} with color RGB(${color.r}, ${color.g}, ${color.b})`);

	// Read the original font file
	const fontData = await filesystem.readBinaryFile(inputPath);

	// Inject color tables
	const colorizedData = injectColorTables(fontData, color);

	// Ensure output directory exists
	const outputDir = path.dirname(outputPath);
	await shellFS.createDirectory(outputDir);

	// Write the colorized font
	await filesystem.writeBinaryFile(outputPath, colorizedData);

	logger.info(`Successfully colorized font: ${outputPath}`);
}

/**
 * Get the path to the icon color cache directory.
 * @returns Path to the icon color cache directory
 */
export async function getIconColorCacheDir(): Promise<string> {
	return path.join(await getCacheDir(), ICON_COLOR_CACHE_DIR);
}

/**
 * Check if the icon color cache exists (files have been generated).
 * @returns True if the cache exists
 */
export async function iconColorCacheExists(): Promise<boolean> {
	const cacheDir = await getIconColorCacheDir();
	const regularFontPath = path.join(cacheDir, 'Font/BuilderIcons-Regular.otf');
	return shellFS.exists(regularFontPath);
}

/**
 * Generate the icon color cache files with the specified color.
 * Creates colorized versions of BuilderIcons fonts in the cache directory.
 * @param hexColor - Hex color string (e.g., "#FF5500")
 */
export async function generateIconColorCache(hexColor: string): Promise<void> {
	const color = hexToRgb(hexColor);
	logger.info(`Generating icon color cache with color: ${hexColor}`);

	// Detect Roblox installation
	const robloxPath = await detectRobloxPath();
	if (!robloxPath) {
		throw new Error('Roblox installation not found. Please install Roblox first.');
	}

	// Check if BuilderIcons fonts exist
	const builderIconsPath = path.join(robloxPath, BUILDER_ICONS_PATH);
	const fontPath = path.join(builderIconsPath, 'Font');

	const regularFontPath = path.join(fontPath, 'BuilderIcons-Regular.ttf');
	const filledFontPath = path.join(fontPath, 'BuilderIcons-Filled.ttf');

	if (!(await shellFS.exists(regularFontPath)) || !(await shellFS.exists(filledFontPath))) {
		throw new Error('BuilderIcons fonts not found in Roblox installation. Roblox may need to be updated.');
	}

	// Create cache directory structure
	const cacheDir = await getIconColorCacheDir();
	const cacheFontPath = path.join(cacheDir, 'Font');

	// Remove existing cache if present
	if (await shellFS.exists(cacheDir)) {
		await shellFS.remove(cacheDir);
	}

	// Create the cache directory structure
	await shellFS.createDirectory(cacheFontPath);

	// Colorize fonts and save as .otf (required for the mod to work)
	await colorizeFont(regularFontPath, path.join(cacheFontPath, 'BuilderIcons-Regular.otf'), color);
	await colorizeFont(filledFontPath, path.join(cacheFontPath, 'BuilderIcons-Filled.otf'), color);

	// Create JSON file that references the .otf files
	const jsonContent = {
		name: 'Builder Icons',
		loadStrategy: 'sameFamilyOnly',
		faces: [
			{
				name: 'Regular',
				weight: 400,
				style: 'normal',
				assetId: 'rbxasset://LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons/Font/BuilderIcons-Regular.otf',
			},
			{
				name: 'Bold',
				weight: 700,
				style: 'normal',
				assetId: 'rbxasset://LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons/Font/BuilderIcons-Filled.otf',
			},
		],
	};

	await filesystem.writeFile(path.join(cacheDir, 'BuilderIcons.json'), JSON.stringify(jsonContent, null, 2));

	logger.info(`Icon color cache generated at: ${cacheDir}`);
}

/**
 * Remove the icon color cache.
 */
export async function removeIconColorCache(): Promise<void> {
	const cacheDir = await getIconColorCacheDir();
	if (await shellFS.exists(cacheDir)) {
		await shellFS.remove(cacheDir);
		logger.info('Icon color cache removed');
	}
}
