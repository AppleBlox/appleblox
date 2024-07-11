import { toast } from "svelte-sonner";
import { dataPath, loadSettings } from "../settings";
import { pathExists } from "../utils";
import { filesystem, os } from "@neutralinojs/lib";
import path from "path-browserify";
import { sleep } from "$lib/appleblox";
import { getRobloxPath } from "./path";

/** Checks if roblox is installed, and if not show a popup */
export async function hasRoblox(popup = true): Promise<boolean> {
	if (await pathExists(path.join(getRobloxPath(), "Contents/MacOS/RobloxPlayer"))) {
		return true;
	} else {
		if (!popup) return false;
		os.execCommand(`osascript <<'END'
    set theAlertText to "Roblox is not installed"
    set theAlertMessage to "To use AppleBlox, you first need to install Roblox. Would you like to open the download page?"
    display alert theAlertText message theAlertMessage as critical buttons {"Cancel", "Open link"} default button "Open link" cancel button "Cancel" giving up after 60
    set the button_pressed to the button returned of the result
    if the button_pressed is "Open link" then
        open location "https://roblox.com/download"
    end if
END`);
		return false;
	}
}

/** Uses cli to check if any instance of roblox is open */
export async function isRobloxOpen() {
	const cmd = await os.execCommand('ps aux | grep "Roblox" | grep -v "grep"');
	return cmd.stdOut.includes("Roblox");
}

/** Returns a JSON object in the form of the ClientSettings.json file for the FFLags */

export async function enableMultiInstance() {
	try {
		if (!(await hasRoblox())) return;
		if (await isRobloxOpen()) {
			toast.info("Closing Roblox...", { duration: 1000 });
			console.log("Closing Roblox");
			const robloxKill = await os.execCommand(`pkill -9 Roblox`);
			console.log(robloxKill);

			await sleep(2000);
		}

		toast.info("Opening Roblox...", { duration: 1000 });
		console.log("Opening Roblox");
		await os.execCommand(`open "${getRobloxPath()}"`, { background: true });

		await sleep(1000);

		toast.info("Terminating all processes...", { duration: 1000 });
		console.log("Terminating all Roblox processes");
		const result = await os.execCommand("ps aux | grep -i roblox | grep -v grep | awk '{print $2}' | xargs");
		console.log(result);
		const processes = result.stdOut.trim().split(" ");
		for (const proc of processes) {
			console.log(`Terminating Roblox Process (PID: ${proc})`);

			try {
				const cmd = await os.execCommand(`kill -9 ${proc}`);
				console.log(cmd);
			} catch (err) {
				console.error(`Error terminating process ${proc}: ${err}`);
				toast.error(`Error terminating process ${proc}: ${err}`);
			}
		}

		toast.success("Multi-instance should now be working!");
	} catch (err) {
		toast.error("An error occured while enabling MultiInstance");
		console.error("An error occured while enabling MultiInstance");
		console.error(err);
	}
}
