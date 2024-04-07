import { pathExists } from "./utils";

export async function hasRoblox(): Promise<boolean> {
    if (await pathExists("/Applications/Roblox.app/Contents/MacOS/RobloxPlayer")) {
        return true
    } else {
        return false
    }
}