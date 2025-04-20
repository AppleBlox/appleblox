import { filesystem, os } from '@neutralinojs/lib';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import Roblox from '.';
import { getValue } from '../../components/settings';
import { Notification } from '../tools/notifications';
import shellFS from '../tools/shellfs';
import { sleep } from '../utils';
import { getMostRecentRoblox } from './path';
import { shell } from '../tools/shell';

export class RobloxMods {
	/** Load mods from the AppleBlox/mods folder */
	static async loadMods(): Promise<{ filename: string; path: string; state: boolean }[]> {
		const modsFolder = path.join(await os.getEnv('HOME'), 'Library', 'Application Support', 'AppleBlox', 'mods');
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
			.reverse(); // Alphabetical priority
	}

	/** Creates a backup of the roblox Resources folder */
	static async createBackup(force = false) {
		const appSupportFolder = path.join(await os.getEnv('HOME'), 'Library', 'Application Support', 'AppleBlox');
		const modsCacheFolder = path.join(appSupportFolder, 'cache', 'mods');
		await shellFS.createDirectory(modsCacheFolder);
		const resBackupFolder = path.join(modsCacheFolder, 'Resources');
		if (await shellFS.exists(resBackupFolder)) {
			if (!force) return;
			console.info('[Roblox.Mods] Replacing old backup with a new one.');
		}
		const robloxResFolder = path.join(Roblox.path, 'Contents', 'Resources');
		await shellFS.copy(robloxResFolder, modsCacheFolder, true);
	}

	/** Copy the mods to Roblox's files */
	static async copyToFiles() {
		// Load the mods.
		const mods = (await RobloxMods.loadMods()).filter((m) => m.state);
		console.info('[Roblox.Mods] Loading mods:', mods);
		if (mods.length < 1) {
			console.info('[Roblox.Mods] No mods to apply.');
			return;
		}

		await this.createBackup();
		const resourcesFolder = path.join(Roblox.path, 'Contents/Resources/');
		for (const mod of mods) {
			const subs = (await filesystem.readDirectory(mod.path, { recursive: false })).filter((s) => s.entry !== '.DS_Store');
			for (const sub of subs) {
				// Merge mod subfolder with roblox files
				await shellFS.merge(sub.path, resourcesFolder);
			}
		}
	}

	/** Restore original roblox folders */
	static async restoreRobloxFolders() {
		const appSupportFolder = path.join(await os.getEnv('HOME'), 'Library', 'Application Support', 'AppleBlox');
		const resourcesFolder = path.join(Roblox.path, 'Contents/Resources');
		const resBackupFolder = path.join(appSupportFolder, 'cache', 'mods', 'Resources');
		if (!(await shellFS.exists(resBackupFolder))) {
			toast.error("The 'Resources' backup hasn't been found. Mods will not be removed.");
			new Notification({
				title: 'Error while removing mods',
				content: "The 'Resources' backup hasn't been found. Mods will not be removed.",
				sound: 'hero',
				timeout: 6,
			}).show();
			return;
		}

		await shellFS.remove(resourcesFolder);
		await shellFS.copy(resBackupFolder, resourcesFolder, true);
		await shellFS.remove(resBackupFolder);
		new Notification({
			title: 'Resources restored',
			content: 'Roblox has been cleaned of any Mods remnants.',
			timeout: 7,
		}).show();
		await sleep(100);
	}

	/** Applies the custom font */
	static async applyCustomFont() {
		// Exit if set to null
		const fontValue = (await getValue('mods.builtin.custom_font')) as string | null;
		if (!fontValue) return;

		console.info('[Mods] Applying custom font...');

		const fontExt = path.extname(fontValue);
		const fontPath = path.join(
			await os.getEnv('HOME'),
			`Library/Application Support/AppleBlox/cache/fonts/CustomFont${fontExt}`
		);
		if (!(await shellFS.exists(fontPath))) {
			console.error('[Mods] Could not find the path to the custom font file.');
			return;
		}
		const robloxFontsPath = path.join(Roblox.path, 'Contents/Resources/content/fonts');
		if (!(await shellFS.exists(robloxFontsPath))) {
			console.error('[Mods] Could not find the roblox fonts folder.');
			return;
		}
		const fontFamiliesPath = path.join(robloxFontsPath, 'families');

		// Copy CustomFont.* file and make a backup
		const fontsCacheDir = path.join(await os.getEnv('HOME'), 'Library/Application Support/AppleBlox/cache/fonts/families');
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
				console.error(`[Mods] Error when applying custom font to: "${file.path}"`);
			}
		}

		console.info('[Mods] Added custom font');
	}

	/** Removes the custom font */
	static async removeCustomFont() {
		// Exit if set to null
		const fontValue = (await getValue('mods.builtin.custom_font')) as string | null;
		if (!fontValue) return;

		const fontExt = path.extname(fontValue);
		const fontsFolderPath = path.join(Roblox.path, 'Contents/Resources/content/fonts');
		const customFontPath = path.join(Roblox.path, fontsFolderPath, `CustomFont${fontExt}`);
		const familiesPath = path.join(Roblox.path, fontsFolderPath, 'families');
		const cacheDir = path.join(await os.getEnv('HOME'), 'Library/Application Support/AppleBlox/cache/fonts/families');

		await shellFS.remove(customFontPath);
		await shellFS.remove(familiesPath);
		await shellFS.copy(cacheDir, fontsFolderPath, true);
		await shellFS.remove(cacheDir);

		console.info('[Mods] Removed custom font');
	}

	/** Toggle NSHighResolutionCapable in Roblox's plist flie */
	static async toggleHighRes(state: boolean) {
		// Get the path to Roblox's Info.plist file
		const plistPath = path.join(await getMostRecentRoblox(), 'Contents/Info.plist');
		await shell(`/usr/libexec/PlistBuddy -c "Set :NSHighResolutionCapable ${state}" "${plistPath}"`, [], {
			completeCommand: true,
		});
		console.info(`[Roblox.Mods] Set NSHighResolutionCapable to ${state}`);
	}
}
