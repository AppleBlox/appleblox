import Logger from '@/windows/main/ts/utils/logger';

const logger = Logger.withContext('BinaryCookies');

/** Mac absolute time epoch offset: seconds between 1970-01-01 and 2001-01-01 */
const MAC_EPOCH_OFFSET = 978307200;

export interface ParsedCookie {
	name: string;
	value: string;
	domain: string;
	path: string;
	flags: number;
	expiry: Date | null;
	creation: Date | null;
}

/** Read a null-terminated UTF-8 string from the DataView at the given byte offset */
function readNullTerminatedString(view: DataView, offset: number): string {
	const bytes: number[] = [];
	let i = offset;
	while (i < view.byteLength && view.getUint8(i) !== 0) {
		bytes.push(view.getUint8(i));
		i++;
	}
	return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}

/** Convert a Mac absolute time (seconds since 2001-01-01) to a JS Date, or null if zero */
function macTimeToDate(macTime: number): Date | null {
	if (macTime === 0) return null;
	return new Date((macTime + MAC_EPOCH_OFFSET) * 1000);
}

/**
 * Parse an Apple .binarycookies file into an array of cookie objects.
 *
 * Format reference (reverse-engineered):
 *  - 4 bytes magic "cook"
 *  - UInt32 BE: number of pages
 *  - numPages × UInt32 BE: page sizes
 *  - Pages (each containing cookies)
 *  - File footer / checksum (ignored)
 */
export function parseBinaryCookies(buffer: ArrayBuffer): ParsedCookie[] {
	const view = new DataView(buffer);
	const cookies: ParsedCookie[] = [];

	// Validate magic header
	const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
	if (magic !== 'cook') {
		throw new Error(`Not a binarycookies file (magic: "${magic}")`);
	}

	// Number of pages
	const numPages = view.getUint32(4, false); // big-endian

	// Read page sizes
	const pageSizes: number[] = [];
	let offset = 8;
	for (let i = 0; i < numPages; i++) {
		pageSizes.push(view.getUint32(offset, false)); // big-endian
		offset += 4;
	}

	// Parse each page
	for (let p = 0; p < numPages; p++) {
		const pageStart = offset;
		const pageEnd = pageStart + pageSizes[p];

		// Page header (expected 0x00000100, little-endian, or 0x00010000 big-endian)
		const pageHeader = view.getUint32(pageStart, true);
		if (pageHeader !== 0x00000100 && pageHeader !== 0x00010000) {
			logger.warn(`Unexpected page header: 0x${pageHeader.toString(16)} at offset ${pageStart}`);
		}

		// Number of cookies in this page
		const numCookies = view.getUint32(pageStart + 4, true); // little-endian

		// Cookie offsets (relative to page start)
		const cookieOffsets: number[] = [];
		for (let c = 0; c < numCookies; c++) {
			cookieOffsets.push(view.getUint32(pageStart + 8 + c * 4, true)); // little-endian
		}

		// Parse each cookie
		for (let c = 0; c < numCookies; c++) {
			const cookieStart = pageStart + cookieOffsets[c];

			try {
				// Cookie header fields (all little-endian)
				// const cookieSize = view.getUint32(cookieStart, true);
				const cookieFlags = view.getUint32(cookieStart + 4, true);
				// skip 4 bytes unknown at cookieStart + 8
				const urlOffset = view.getUint32(cookieStart + 16, true);
				const nameOffset = view.getUint32(cookieStart + 20, true);
				const pathOffset = view.getUint32(cookieStart + 24, true);
				const valueOffset = view.getUint32(cookieStart + 28, true);
				// skip 8 bytes comment at cookieStart + 32
				const expiryTime = view.getFloat64(cookieStart + 40, true);
				const creationTime = view.getFloat64(cookieStart + 48, true);

				const domain = readNullTerminatedString(view, cookieStart + urlOffset);
				const name = readNullTerminatedString(view, cookieStart + nameOffset);
				const path = readNullTerminatedString(view, cookieStart + pathOffset);
				const value = readNullTerminatedString(view, cookieStart + valueOffset);

				cookies.push({
					name,
					value,
					domain,
					path,
					flags: cookieFlags,
					expiry: macTimeToDate(expiryTime),
					creation: macTimeToDate(creationTime),
				});
			} catch (err) {
				logger.warn(`Failed to parse cookie ${c} in page ${p}:`, err);
			}
		}

		offset = pageEnd;
	}

	return cookies;
}

/**
 * Extract the .ROBLOSECURITY cookie value from a parsed cookie list.
 * Returns the value string or null if not found.
 */
export function extractRoblosecurity(cookies: ParsedCookie[]): string | null {
	const cookie = cookies.find((c) => c.name === '.ROBLOSECURITY' && c.domain.includes('.roblox.com'));
	return cookie?.value ?? null;
}

/** Convert a JS Date to Mac absolute time (seconds since 2001-01-01) */
function dateToMacTime(date: Date): number {
	return date.getTime() / 1000 - MAC_EPOCH_OFFSET;
}

/** Encode a string as null-terminated UTF-8 bytes */
function encodeNullTerminated(str: string): Uint8Array {
	const encoded = new TextEncoder().encode(str);
	const result = new Uint8Array(encoded.length + 1);
	result.set(encoded);
	result[encoded.length] = 0;
	return result;
}

/**
 * Build a .binarycookies file from an array of cookie objects.
 * Produces a valid binary that macOS HTTPCookieStorage can read.
 */
export function writeBinaryCookies(cookies: ParsedCookie[]): ArrayBuffer {
	// Build each cookie's binary data first to know page size
	const cookieBuffers: ArrayBuffer[] = [];

	for (const cookie of cookies) {
		const domainBytes = encodeNullTerminated(cookie.domain);
		const nameBytes = encodeNullTerminated(cookie.name);
		const pathBytes = encodeNullTerminated(cookie.path);
		const valueBytes = encodeNullTerminated(cookie.value);

		// Cookie header is 56 bytes (size + flags + unknown + 4 offsets + comment(8) + expiry(8) + creation(8))
		const headerSize = 56;
		const urlOffset = headerSize;
		const nameOffset = urlOffset + domainBytes.length;
		const pathOffset = nameOffset + nameBytes.length;
		const valueOffset = pathOffset + pathBytes.length;
		const totalSize = valueOffset + valueBytes.length;

		const buf = new ArrayBuffer(totalSize);
		const view = new DataView(buf);

		// Cookie size
		view.setUint32(0, totalSize, true);
		// Flags: 0x5 = Secure + HttpOnly
		view.setUint32(4, cookie.flags, true);
		// Unknown field
		view.setUint32(8, 0, true);
		// Unused field
		view.setUint32(12, 0, true);
		// String offsets
		view.setUint32(16, urlOffset, true);
		view.setUint32(20, nameOffset, true);
		view.setUint32(24, pathOffset, true);
		view.setUint32(28, valueOffset, true);
		// Comment (8 bytes, unused)
		view.setFloat64(32, 0, true);
		// Expiry date
		view.setFloat64(40, cookie.expiry ? dateToMacTime(cookie.expiry) : 0, true);
		// Creation date
		view.setFloat64(48, cookie.creation ? dateToMacTime(cookie.creation) : dateToMacTime(new Date()), true);

		// Write string data
		const bytes = new Uint8Array(buf);
		bytes.set(domainBytes, urlOffset);
		bytes.set(nameBytes, nameOffset);
		bytes.set(pathBytes, pathOffset);
		bytes.set(valueBytes, valueOffset);

		cookieBuffers.push(buf);
	}

	// Build page: header(4) + numCookies(4) + offsets(4*n) + footer(4) + cookie data
	const pageHeaderSize = 4 + 4 + cookies.length * 4 + 4;
	let cookiesDataSize = 0;
	for (const buf of cookieBuffers) {
		cookiesDataSize += buf.byteLength;
	}
	const pageSize = pageHeaderSize + cookiesDataSize;

	// File layout: magic(4) + numPages(4) + pageSizes(4*1) + page + checksum(8) + trailer(8)
	const fileSize = 4 + 4 + 4 + pageSize + 8 + 8;
	const fileBuf = new ArrayBuffer(fileSize);
	const fileView = new DataView(fileBuf);
	const fileBytes = new Uint8Array(fileBuf);

	let pos = 0;

	// Magic "cook"
	fileBytes[pos++] = 0x63; // c
	fileBytes[pos++] = 0x6f; // o
	fileBytes[pos++] = 0x6f; // o
	fileBytes[pos++] = 0x6b; // k

	// Number of pages (big-endian)
	fileView.setUint32(pos, 1, false);
	pos += 4;

	// Page size (big-endian)
	fileView.setUint32(pos, pageSize, false);
	pos += 4;

	// Page start
	const pageStart = pos;

	// Page header: 0x00000100 (little-endian)
	fileView.setUint32(pos, 0x00000100, true);
	pos += 4;

	// Number of cookies (little-endian)
	fileView.setUint32(pos, cookies.length, true);
	pos += 4;

	// Cookie offsets (relative to page start, little-endian)
	let cookieDataStart = pageHeaderSize;
	for (const buf of cookieBuffers) {
		fileView.setUint32(pos, cookieDataStart, true);
		pos += 4;
		cookieDataStart += buf.byteLength;
	}

	// Page footer
	fileView.setUint32(pos, 0x00000000, true);
	pos += 4;

	// Cookie data
	for (const buf of cookieBuffers) {
		fileBytes.set(new Uint8Array(buf), pos);
		pos += buf.byteLength;
	}

	// Checksum (8 bytes, zeroed — macOS tolerates this)
	pos += 8;

	// File trailer: big-endian magic 0x071720050000004F
	fileView.setUint32(pos, 0x07172005, false);
	fileView.setUint32(pos + 4, 0x0000004f, false);

	return fileBuf;
}

/**
 * Build a .binarycookies file containing a single .ROBLOSECURITY cookie.
 */
export function buildRoblosecurityFile(cookieValue: string): ArrayBuffer {
	const cookie: ParsedCookie = {
		name: '.ROBLOSECURITY',
		value: cookieValue,
		domain: '.roblox.com',
		path: '/',
		flags: 0x5, // Secure + HttpOnly
		expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
		creation: new Date(),
	};
	return writeBinaryCookies([cookie]);
}
