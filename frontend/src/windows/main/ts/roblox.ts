import { toast } from "svelte-sonner";
import { dataPath } from "./settings";
import { pathExists } from "./utils";
import { filesystem, os } from "@neutralinojs/lib";
import path from "path-browserify";
import { sleep } from "$lib/appleblox";

/** Checks if roblox is installed, and if not show a popup */
export async function hasRoblox(): Promise<boolean> {
	if (await pathExists("/Applications/Roblox.app/Contents/MacOS/RobloxPlayer")) {
		return true;
	} else {
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
export async function parseFFlags(preset = false): Promise<Object> {
	// Get the path to Application Supoort
	const appPath = await dataPath();
	let fflagsJson: { [key: string]: string | number } = {};
	if (preset) {
		const neuPath = path.join(appPath, "fastflags.neustorage");
		const ohioFinalBoss = JSON.parse(await filesystem.readFile(neuPath));
		// i know this isn't efficient, but i didn't want to re-write the fastlfags saving system.
        // in the future, i may change this to a dynamic system.
		for (const name of Object.keys(ohioFinalBoss.presets)) {
            const data = ohioFinalBoss.presets[name]
            console.log(name,data)
			switch (name) {
				case "ff_fps":
					if (data[0] > 60) {
						fflagsJson["FFlagDebugGraphicsDisableMetal"] = "true";  
						fflagsJson["FFlagDebugGraphicsPreferVulkan"] = "true";
					}
					fflagsJson["DFIntTaskSchedulerTargetFps"] = data[0];
					break;
				case "ff_lightning":
					if (data.disabled) break;
					switch (data.value) {
						case "voxel":
							fflagsJson["DFFlagDebugRenderForceTechnologyVoxel"] = "true";
							break;
						case "shadowmap":
							fflagsJson["FFlagDebugForceFutureIsBrightPhase2"] = "true";
							break;
						case "future":
							fflagsJson["FFlagDebugForceFutureIsBrightPhase3"] = "true";
							break;
					}
					break;
				case "ff_engine":
					if (data.disabled) break;
					switch (data.value) {
						// don't know if disabling Metal works, need testing. For now it uses OpenGL
						case "opengl":
							fflagsJson["FFlagDebugGraphicsDisableMetal"] = "true";
							fflagsJson["FFlagDebugGraphicsPreferOpenGL"] = "true";
							break;
						case "metal":
							fflagsJson["FFlagDebugGraphicsPreferMetal"] = "true";
							break;
						case "vulkan":
							fflagsJson["FFlagDebugGraphicsDisableMetal"] = "true";
						    fflagsJson["FFlagDebugGraphicsPreferVulkan"] = "true";
                            break;
					}
                    break;
                case "ff_gui":
                    if (data.length < 1) break;
                    fflagsJson["DFIntCanHideGuiGroupId"] = data
                    break;
                case "ff_display":
                    if (data) {
                        fflagsJson["DFIntDebugFRMQualityLevelOverride"] = 1
                    };
                    break;
                case "ff_graphics":
                    if (data) {
                        fflagsJson["FFlagCommitToGraphicsQualityFix"] = "true"
                        fflagsJson["FFlagFixGraphicsQuality"] = "true"
                    }
                    break;
			}
		}
		return fflagsJson;
	} else {
		const neuPath = path.join(appPath, "fflags.neustorage");
		const skibidiOhioFanumTax: { flag: string; enabled: boolean; value: string | number }[] = JSON.parse(
			await filesystem.readFile(neuPath)
		);
		for (const flag of skibidiOhioFanumTax) {
			if (flag.enabled) {
				fflagsJson[flag.flag] = flag.value;
			}
		}
		return fflagsJson;
	}
}

export async function enableMultiInstance() {
	if (!(await hasRoblox())) return;
	if (await isRobloxOpen()) {
		toast.info("Closing Roblox...",{duration: 1000})
		await os.execCommand(`pkill -9 Roblox`)

		await sleep(2000)

		toast.info("Opening Roblox...",{duration: 1000})
		await os.execCommand("open /Applications/Roblox.app",{background: true})

		await sleep(1000);

		toast.info("Terminating all processes...",{duration: 1000})
		const result = await os.execCommand('ps aux | grep -i roblox | grep -v grep');
        const processes = result.stdOut.split('\n').filter(line => line.includes('roblox'));
		for (const proc of processes) {
            const columns = proc.trim().split(/\s+/);
            const pid = columns[1];
            console.log(`Terminating Roblox Process (PID: ${pid})`);

            try {
                await os.execCommand(`kill -9 ${pid}`);
            } catch (err) {
                console.error(`Error terminating process ${pid}: ${err}`);
				toast.error(`Error terminating process ${pid}: ${err}`)
            }
        }
	}
	// if (!(await isRobloxOpen())) {
	// 	toast.info("Closing Roblox...", { duration: 1000 });
	// 	await os.execCommand(`pkill -9 Roblox`);

	// 	await sleep(1000);

	// 	toast.info("Opening Roblox...", { duration: 1000 });
	// 	const proc = await os.spawnProcess("/Applications/Roblox.app/Contents/MacOS/RobloxPlayer");
	// 	robloxProcessIds.push(proc.id);
	// }
}
