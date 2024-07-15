import { RobloxFFlags } from "./fflags";
import { RobloxInstance } from "./instance";
import { launchRoblox } from "./launch";
import { RobloxUtils } from "./utils";
import { RobloxWindow } from "./window";
import { RobloxMods } from "./mods";

// Simple export
class Roblox {
    static FFlags = RobloxFFlags
    static Instance = RobloxInstance
    static Utils = RobloxUtils
    static Window = RobloxWindow
    static Mods = RobloxMods
    static launch = launchRoblox
}

export default Roblox