import path from "path-browserify";
import { pathExists, sleep } from "../utils";
import { filesystem, os } from "@neutralinojs/lib";
import { getRobloxPath } from "./path";
import shellFS from "../shellfs";

export class RobloxMods {
	/** Load mods from the AppleBlox/mods folder */
	static async loadMods(): Promise<{ filename: string; path: string; state: boolean }[]> {
		const modsFolder = path.join(await os.getEnv("HOME"), "Library/AppleBlox/mods");
		if (!(await pathExists(modsFolder))) return [];
		const entries = await filesystem.readDirectory(modsFolder, { recursive: false });
		const mods = entries.filter((entry) => entry.type === "DIRECTORY");
		return mods
			.map((mod) => ({ filename: mod.entry.replace(/\.disabled$/, ""), path: mod.path, state: !path.basename(mod.path).endsWith(".disabled") }))
			.sort((a, b) => ("" + a).localeCompare(b.filename, undefined, { numeric: true }));
	}

	/** Copy the mods to Roblox's files */
	static async copyToFiles() {
		// Load the mods. We reverse to respect the alphabetical priority
		const mods = (await this.loadMods()).filter((m) => m.state).reverse();
		if (mods.length < 1) return;

		const resourcesFolder = path.join(await getRobloxPath(), "Contents/Resources/");
		// Backup, and don't overwrite previous backups (if the previous backup is still here, that means AppleBlox didn't have the chance to restore it last run)
		const resBackupFolder = path.join(await getRobloxPath(), "Contents/.abloxk");
		if (!await pathExists(resBackupFolder)) {
      console.log("Backing up Resources folder")
			await shellFS.copy(resourcesFolder, path.join(await getRobloxPath(), "Contents/.abloxk"), true);
		}

		for (const mod of mods) {
			console.log(`Adding mod "${mod.path}"`);
			const subs = (await filesystem.readDirectory(mod.path, { recursive: false })).filter((s) => s.entry !== ".DS_Store");
			for (const sub of subs) {
				// Merge mod subfolder with roblox files
				await shellFS.merge(sub.path, resourcesFolder);
			}
		}
	}

	/** Restore original roblox folders */
	static async restoreRobloxFolders() {
		const resourcesFolder = path.join(await getRobloxPath(), "Contents/Resources/");
		const resBackupFolder = path.join(await getRobloxPath(), "Contents/.abloxk");

		await shellFS.remove(resourcesFolder);
		await shellFS.copy(resBackupFolder, resourcesFolder, true);
		await shellFS.remove(resBackupFolder);

		await sleep(100);
	}
}
