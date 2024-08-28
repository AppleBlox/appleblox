import { RobloxFFlags } from './fflags';
import { RobloxInstance } from './instance';
import { launchRoblox } from './launch';
import { RobloxMods } from './mods';
import { RobloxUtils } from './utils';
import { RobloxWindow } from './window';

// Simple export
class Roblox {
	static FFlags = RobloxFFlags;
	static Instance = RobloxInstance;
	static Utils = RobloxUtils;
	static Window = RobloxWindow;
	static Mods = RobloxMods;
	static launch = launchRoblox;
}

export default Roblox;
