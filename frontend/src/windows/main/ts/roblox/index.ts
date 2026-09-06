import { RobloxDelegate } from './delegate';
import { RobloxDownloader } from './downloader';
import { RobloxFFlags } from './fflags';
import { RobloxInstance } from './instance';
import { launchRoblox } from './launch';
import { RobloxMods } from './mods';
import { PathManager } from './path-manager';
import { RobloxUpdates } from './updates';
import { RobloxUtils } from './utils';
import * as RobloxVersion from './version';

class Roblox {
	static FFlags = RobloxFFlags;
	static Instance = RobloxInstance;
	static Utils = RobloxUtils;
	static Mods = RobloxMods;
	static Delegate = RobloxDelegate;
	static launch = launchRoblox;
	static Version = RobloxVersion;
	static Downloader = RobloxDownloader;
	static Updates = RobloxUpdates;

	/**
	 * Gets the current Roblox installation path.
	 * Returns null if Roblox is not found.
	 * @returns The path to Roblox.app, or null if not found
	 */
	static get path(): string | null {
		return PathManager.getPath();
	}

	/**
	 * Re-runs Roblox path detection.
	 * Useful when user clicks "Re-detect" or when cached path becomes invalid.
	 * @returns The newly detected path, or null if not found
	 */
	static async refreshPath(): Promise<string | null> {
		return PathManager.refreshPath();
	}
}

export default Roblox;
