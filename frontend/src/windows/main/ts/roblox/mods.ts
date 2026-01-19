import { events, filesystem, os } from '@neutralinojs/lib';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import Roblox from '.';
import { getValue } from '../../components/settings';
import { Notification } from '../tools/notifications';
import { shell } from '../tools/shell';
import shellFS from '../tools/shellfs';
import Logger from '../utils/logger';
import { getDataDir, getModsDir, getModsCacheDir, getFontsCacheDir, getCacheDir } from '../utils/paths';
import { detectRobloxPath } from './path';
import { getIconColorCacheDir, iconColorCacheExists } from './font-colorizer';

const logger = Logger.withContext('Mods');

export class RobloxMods {
	/** Load mods from the AppleBlox/mods folder */
	static async loadMods(): Promise<{ filename: string; path: string; state: boolean }[]> {
		const modsFolder = await getModsDir();
		if (!(await shellFS.exists(modsFolder))) return [];
		const entries = await filesystem.readDirectory(modsFolder, {
			recursive: false,
		});
		const mods = entries.filter((entry) => entry.type === 'DIRECTORY');
		return mods
			.map((mod) => ({
				filename: mod.entry.replace(/\.disabled$/, ''),
				path: mod.path,
				state: !path.basename(mod.path).endsWith('.disabled'),
			}))
			.sort((a, b) => `${a}`.localeCompare(b.filename, undefined, { numeric: true }))
			.reverse(); // Alphabetical order
	}

	/** Creates a backup of the roblox Resources folder */
	static async createBackup(force = false) {
		const robloxPath = Roblox.path;
		if (!robloxPath) {
			throw new Error('Roblox installation not found. Cannot create backup.');
		}
		const modsCacheFolder = await getModsCacheDir();
		await shellFS.createDirectory(modsCacheFolder);
		const resBackupFolder = path.join(modsCacheFolder, 'Resources');
		if (await shellFS.exists(resBackupFolder)) {
			if (!force) return;
			logger.info('Replacing old backup with a new one.');
		}
		const robloxResFolder = path.join(robloxPath, 'Contents', 'Resources');
		await shellFS.copy(robloxResFolder, modsCacheFolder, true);
	}

	/** Copy the mods to Roblox's files */
	static async copyToFiles() {
		const robloxPath = Roblox.path;
		if (!robloxPath) {
			throw new Error('Roblox installation not found. Cannot apply mods.');
		}
		// Load the mods.
		const mods = (await RobloxMods.loadMods()).filter((m) => m.state);
		logger.info('Loading mods:', mods);
		if (mods.length < 1) {
			logger.info('No mods to apply.');
			return;
		}

		await this.createBackup();
		const resourcesFolder = path.join(robloxPath, 'Contents/Resources/');
		for (const mod of mods) {
			const subs = (await filesystem.readDirectory(mod.path, { recursive: false })).filter((s) => s.entry !== '.DS_Store');
			for (const sub of subs) {
				// Merge mod subfolder with roblox files
				await shellFS.merge(sub.path, resourcesFolder);
			}
		}
	}

	/** Restore original roblox folders */
	static async restoreRobloxFolders(areModsEnabled = true) {
		const robloxPath = Roblox.path;
		if (!robloxPath) {
			throw new Error('Roblox installation not found. Cannot restore folders.');
		}
		events.broadcast('mods:restoring', true);

		await this.removeCustomFont();

		const resourcesFolder = path.join(robloxPath, 'Contents/Resources');
		const resBackupFolder = path.join(await getModsCacheDir(), 'Resources');
		if (!(await shellFS.exists(resBackupFolder))) {
			// No backup exists - this is fine if no mods were actually applied
			// (e.g., mods enabled but no individual mods selected)
			events.broadcast('mods:restoring', false);
			return;
		}

		await shellFS.remove(resourcesFolder);
		await shellFS.copy(resBackupFolder, resourcesFolder, true);
		await shellFS.remove(resBackupFolder);
		new Notification({
			title: 'Resources restored',
			content: 'Roblox has been cleaned of any mods.',
			timeout: 7,
			sound: 'pop',
		}).show();
		events.broadcast('mods:restoring', false);
	}

	/** Applies the custom font */
	static async applyCustomFont() {
		const robloxPath = Roblox.path;
		if (!robloxPath) {
			throw new Error('Roblox installation not found. Cannot apply custom font.');
		}
		// Exit if set to null
		const fontValue = (await getValue('mods.builtin.custom_font')) as string | null;
		if (!fontValue) return;

		logger.info('Applying custom font...');

		const fontExt = path.extname(fontValue);
		const fontPath = path.join(await getFontsCacheDir(), `CustomFont${fontExt}`);
		if (!(await shellFS.exists(fontPath))) {
			logger.error('Could not find the path to the custom font file.');
			return;
		}
		const robloxFontsPath = path.join(robloxPath, 'Contents/Resources/content/fonts');
		if (!(await shellFS.exists(robloxFontsPath))) {
			logger.error('Could not find the roblox fonts folder.');
			return;
		}
		const fontFamiliesPath = path.join(robloxFontsPath, 'families');

		// Copy CustomFont.* file and make a backup
		const fontsCacheDir = path.join(await getFontsCacheDir(), 'families');
		if (!(await shellFS.exists(fontsCacheDir))) {
			await shellFS.copy(fontPath, robloxFontsPath);
			await shellFS.createDirectory(path.dirname(fontsCacheDir));
			await shellFS.copy(fontFamiliesPath, fontsCacheDir, true);
		}

		// Apply to every files
		const entries = await filesystem.readDirectory(fontFamiliesPath);
		for (const file of entries) {
			try {
				const content = await filesystem.readFile(file.path);
				const jsonContent = JSON.parse(content);
				for (const [key] of Object.keys(jsonContent.faces)) {
					jsonContent.faces[key].assetId = `rbxasset://fonts/CustomFont${fontExt}`;
				}
				await filesystem.writeFile(file.path, JSON.stringify(jsonContent));
			} catch (err) {
				logger.error(`Error when applying custom font to: "${file.path}"`);
			}
		}

		logger.info('Added custom font');
	}

	/** Removes the custom font */
	static async removeCustomFont() {
		const robloxPath = Roblox.path;
		if (!robloxPath) {
			throw new Error('Roblox installation not found. Cannot remove custom font.');
		}
		// Exit if set to null
		const customFont = (await getValue('mods.builtin.custom_font')) as string | null;
		let fontValue = customFont;
		if (!fontValue) {
			const fontsCachePath = await getFontsCacheDir();
			const lastFontPath = await shell(
				`files=(${fontsCachePath}/LastCustomFont*.ttf ${fontsCachePath}/LastCustomFont*.otf ${fontsCachePath}/LastCustomFont*.ttc); real_files=(); for f in "\${files[@]}"; do [ -f "$f" ] && real_files+=("$f"); done; [ "\${#real_files[@]}" -gt 1 ] && echo "too_many" || [ "\${#real_files[@]}" -eq 1 ] && echo "$(basename "\${real_files[0]}")" || echo "null"`,
				[],
				{ completeCommand: true }
			);
			if (lastFontPath.stdOut.includes('null')) {
				return;
			} else if (lastFontPath.stdOut.includes('too_many')) {
				await shellFS.remove(await getFontsCacheDir());
				new Notification({
					title: "Couldn't remove custom font",
					content: 'Too many backups were found.',
					sound: 'sosumi',
					timeout: 10,
				}).show();
				return;
			} else {
				const basename = path.basename(lastFontPath.stdOut.trim());
				fontValue = basename;
			}
		}

		const fontExt = path.extname(fontValue);
		const fontsFolderPath = path.join(robloxPath, 'Contents/Resources/content/fonts');
		const customFontPath = path.join(robloxPath, fontsFolderPath, `CustomFont${fontExt}`);
		const familiesPath = path.join(robloxPath, fontsFolderPath, 'families');
		const cacheDir = path.join(await getFontsCacheDir(), 'families');
		if (!(await shellFS.exists(cacheDir))) {
			if (await shellFS.exists(customFontPath)) {
				new Notification({
					title: "Couldn't remove font",
					content: "An error occured and fonts weren't restored.",
					timeout: 10,
					sound: 'sosumi',
				}).show();
			}
			return;
		}

		await shellFS.remove(customFontPath);
		await shellFS.remove(familiesPath);
		await shellFS.copy(cacheDir, fontsFolderPath, true);
		await shellFS.remove(cacheDir);

		logger.info('Removed custom font');
		if (customFont) {
			new Notification({
				title: 'Removed custom font',
				content: "Restored Roblox's default fonts.",
				timeout: 5,
			}).show();
		}
	}

	/**
	 * Toggle NSHighResolutionCapable in Roblox's plist file
	 * @deprecated This method is no longer used. Legacy resolution is now handled via -AppleMagnifiedMode launch argument in RobloxInstance.start()
	 */
	static async toggleHighRes(state: boolean) {
		// Get the path to Roblox's Info.plist file
		const robloxPath = await detectRobloxPath();
		if (!robloxPath) {
			throw new Error('Roblox installation not found. Cannot toggle high resolution.');
		}
		const plistPath = path.join(robloxPath, 'Contents/Info.plist');
		await shell(`/usr/libexec/PlistBuddy -c "Set :NSHighResolutionCapable ${state}" "${plistPath}"`, [], {
			completeCommand: true,
		});
		logger.info(`Set NSHighResolutionCapable to ${state}`);
	}

	/** Applies the custom icon color */
	static async applyIconColor() {
		const robloxPath = Roblox.path;
		if (!robloxPath) {
			throw new Error('Roblox installation not found. Cannot apply icon color.');
		}

		// Check if icon color is enabled
		let iconColorEnabled = false;
		try {
			iconColorEnabled = (await getValue('mods.builtin.icon_color_enabled')) === true;
		} catch {
			// Setting doesn't exist
		}

		if (!iconColorEnabled) return;

		// Check if cache exists
		if (!(await iconColorCacheExists())) {
			logger.warn('Icon color is enabled but cache does not exist');
			return;
		}

		logger.info('Applying custom icon color...');

		const cacheDir = await getIconColorCacheDir();
		const robloxBuilderIconsPath = path.join(
			robloxPath,
			'Contents/Resources/ExtraContent/LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons'
		);

		// Copy cached colorized font files to Roblox
		const cacheFontPath = path.join(cacheDir, 'Font');
		const robloxFontPath = path.join(robloxBuilderIconsPath, 'Font');
		if (await shellFS.exists(cacheFontPath)) {
			await shellFS.merge(cacheFontPath + '/', robloxFontPath + '/');
		}

		// Copy the JSON file that references .otf files
		const cacheJsonPath = path.join(cacheDir, 'BuilderIcons.json');
		if (await shellFS.exists(cacheJsonPath)) {
			await shellFS.copy(cacheJsonPath, path.join(robloxBuilderIconsPath, 'BuilderIcons.json'));
		}

		logger.info('Applied custom icon color');
	}

	/** Creates backup of BuilderIcons before any mods are applied */
	static async createIconColorBackup() {
		const robloxPath = Roblox.path;
		if (!robloxPath) {
			throw new Error('Roblox installation not found. Cannot create icon color backup.');
		}

		const iconColorBackupDir = path.join(await getCacheDir(), 'icon-color-backup');
		if (await shellFS.exists(iconColorBackupDir)) {
			// Backup already exists
			return;
		}

		const robloxBuilderIconsPath = path.join(
			robloxPath,
			'Contents/Resources/ExtraContent/LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons'
		);

		// Only create backup if BuilderIcons exists
		if (!(await shellFS.exists(robloxBuilderIconsPath))) {
			return;
		}

		logger.info('Creating backup of original BuilderIcons...');
		await shellFS.createDirectory(iconColorBackupDir);
		await shellFS.copy(path.join(robloxBuilderIconsPath, 'Font'), path.join(iconColorBackupDir, 'Font'), true);
		await shellFS.copy(
			path.join(robloxBuilderIconsPath, 'BuilderIcons.json'),
			path.join(iconColorBackupDir, 'BuilderIcons.json')
		);
		logger.info('Created backup of original BuilderIcons');
	}

	/** Removes the custom icon color and restores original files */
	static async removeIconColor(restoreFiles = true) {
		const robloxPath = Roblox.path;
		if (!robloxPath) {
			throw new Error('Roblox installation not found. Cannot remove icon color.');
		}

		const iconColorBackupDir = path.join(await getCacheDir(), 'icon-color-backup');
		if (!(await shellFS.exists(iconColorBackupDir))) {
			// No backup exists, nothing to restore
			return;
		}

		logger.info('Removing custom icon color...');

		if (restoreFiles) {
			const robloxBuilderIconsPath = path.join(
				robloxPath,
				'Contents/Resources/ExtraContent/LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons'
			);

			// Restore font files from backup
			const backupFontPath = path.join(iconColorBackupDir, 'Font');
			const robloxFontPath = path.join(robloxBuilderIconsPath, 'Font');

			if (await shellFS.exists(backupFontPath)) {
				// Remove modified font files and restore originals
				await shellFS.remove(robloxFontPath);
				await shellFS.copy(backupFontPath, robloxFontPath, true);
			}

			// Restore JSON file from backup
			const backupJsonPath = path.join(iconColorBackupDir, 'BuilderIcons.json');
			if (await shellFS.exists(backupJsonPath)) {
				await shellFS.copy(backupJsonPath, path.join(robloxBuilderIconsPath, 'BuilderIcons.json'));
			}
		}

		// Remove backup
		await shellFS.remove(iconColorBackupDir);

		logger.info('Removed custom icon color');
	}
}
