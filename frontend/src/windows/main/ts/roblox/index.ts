import { RobloxDelegate } from './delegate';
import { RobloxDownloader } from './downloader';
import { RobloxFFlags } from './fflags';
import { RobloxInstance } from './instance';
import { launchRoblox } from './launch';
import { RobloxMods } from './mods';
import { getMostRecentRoblox } from './path';
import { RobloxUtils } from './utils';
import * as RobloxVersion from './version';

let robloxPath = '/Applications/Roblox.app'; // Most common path
getMostRecentRoblox()
	.then((path) => (robloxPath = path))
	.catch((err) => {
		console.error("An error occured while trying to get Roblox's most recent path:", err);
	});

class Roblox {
	static FFlags = RobloxFFlags;
	static Instance = RobloxInstance;
	static Utils = RobloxUtils;
	static Mods = RobloxMods;
	static Delegate = RobloxDelegate;
	static launch = launchRoblox;
	static path = robloxPath;
	static Version = RobloxVersion;
	static Downloader = RobloxDownloader;
}

export default Roblox;
