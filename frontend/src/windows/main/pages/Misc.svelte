<script lang="ts">
	import type { SettingsPanel } from "@/types/settings";
	import Panel from "./Settings/Panel.svelte";
	import { saveSettings } from "../ts/settings";
	import { toast } from "svelte-sonner";
	import { enableMultiInstance, isRobloxOpen, parseFFlags } from "../ts/roblox";
	import { events, filesystem, os } from "@neutralinojs/lib";
	import { sleep } from "$lib/appleblox";
	import AppIcon from "@/assets/play.icns";
	import path from "path-browserify";
	import { pathExists } from "../ts/utils";
	import { enableConsoleRedirection } from "../ts/debugging";

	function settingsChanged(o: Object) {
		saveSettings("misc", o);
	}

	async function loadImageToBlob(url: string): Promise<Blob> {
		const response = await fetch(url);
		const blob = await response.blob();
		return blob;
	}

	async function buttonClicked(e: CustomEvent) {
		const id = e.detail;
		switch (id) {
			case "multi_roblox_btn":
				await enableMultiInstance();
				break;
			case "open_instance_btn":
				os.spawnProcess("/Applications/Roblox.app/Contents/MacOS/RobloxPlayer; exit");
				break;
			case "close_roblox_btn":
				await os.execCommand(`ps aux | grep -i roblox | grep -v grep | awk '{print $2}' | xargs kill -9`);
				toast.success("All Roblox Instances have been closed.");
				break;
			case "create_shortcut_btn":
				const savePath = await os
					.showFolderDialog("Where should the shortcut be created?", { defaultPath: "/Applications/" })
					.catch(console.error);
				if (!savePath) {
					toast.error("An error occured while trying to save the shortcut", { duration: 2000 });
					return;
				}
				try {
					if (await pathExists(path.join(savePath, "Launch Roblox.app"))) {
						await filesystem.remove(path.join(savePath, "Launch Roblox.app"));
					}
					await filesystem.createDirectory(path.join(savePath, "Launch Roblox.app/Contents/MacOS"));
					await filesystem.createDirectory(path.join(savePath, "Launch Roblox.app/Contents/Resources"));
					await filesystem.writeFile(
						path.join(savePath, "Launch Roblox.app/Contents/Info.plist"),
						`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launch</string>
	<key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>CFBundleSupportedPlatforms</key>
    <array>
        <string>MacOSX</string>
    </array>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.games</string>
</dict>
</plist>`
					);
					const blob = await loadImageToBlob(AppIcon);
					await filesystem.writeBinaryFile(
						path.join(savePath, "Launch Roblox.app/Contents/Resources/icon.icns"),
						await blob.arrayBuffer()
					);
					await filesystem.writeFile(
						path.join(savePath, "Launch Roblox.app/Contents/MacOS/launch"),
						"#!/bin/bash\n" + path.join(path.dirname(window.NL_PATH), "MacOS/bootstrap") + " --launch"
					);
					await os.execCommand(
						`chmod +x ${path.join(savePath, "Launch Roblox.app/Contents/MacOS/launch").replaceAll(" ", "\\ ")}`
					);
					toast.success(`Created a shortcut at "${path.join(savePath, "Launch Roblox.app")}"`);
				} catch (err) {
					console.error(err);
					toast.error("An error occured while trying to save the shortcut", { duration: 2000 });
					return;
				}
				break;
			case "write_clientappsettings_btn":
				try {
					const filePath = "/Applications/Roblox.app/Contents/MacOS/ClientSettings/AppClientSettings.json";
					if (await pathExists(filePath)) {
						await filesystem.remove(filePath);
					}
					await filesystem.createDirectory(path.dirname(filePath));
					const fflags = { ...(await parseFFlags(false)), ...(await parseFFlags(true)) };
					await filesystem.writeFile(filePath, JSON.stringify(fflags));
					toast.success(`Wrote ClientAppSettings at "${filePath}"`);
				} catch (err) {
					console.error(err);
					toast.error("An error occured while writing ClientAppSettings.json");
				}
				break;
			case "redirect_console":
				enableConsoleRedirection();
				toast.success("Console redirection enabled", { duration: 1000 });
				break;
			case "open_logs":
				const logPath = path.join(window.NL_PATH,"neutralinojs.log")
				if (!await pathExists(logPath)) {
					toast.error("The logs file doesn't seem to exist.")
					return;
				}
				os.execCommand(`open "${logPath}"`).catch(console.error)
		}
	}

	const panelOpts: SettingsPanel = {
		name: "Misc",
		description: "Various miscellaneous features and options",
		id: "misc",
		sections: [
			{
				name: "Multi Instances",
				description: "Makes it so multiple Roblox windows can be opnened at once.",
				id: "multi_instances",
				interactables: [
					{
						label: "Enable Multi Instances",
						description: "Makes it so multiple Roblox windows can be opnened at once.",
						id: "multi_roblox_btn",
						options: {
							type: "button",
							style: "default",
						},
					},
					{
						label: "Open Instance",
						description: "Opens an instance of the Roblox app. (Achieves the same goal as opening from the web)",
						id: "open_instance_btn",
						options: {
							type: "button",
							style: "secondary",
						},
					},
					{
						label: "Terminate all instances",
						description:
							"Closes every open Roblox instances. (This acts as a force-kill, so be sure to use this appropriately)",
						id: "close_roblox_btn",
						options: {
							type: "button",
							style: "destructive",
						},
					},
				],
			},
			{
				name: "Roblox Launching",
				description: "Settings about launching Roblox",
				id: "roblox_launching",
				interactables: [
					{
						label: "Create a launch shortcut",
						description:
							"Creates a shortcut that can be used to launch Roblox (with all the AppleBlox features) without having to open this app.",
						id: "create_shortcut_btn",
						options: {
							type: "button",
							style: "default",
						},
					},
					{
						label: "Write ClientAppSettings.json",
						description:
							"Saves the FastFlags to Roblox directly for them to be used without using AppleBlox. This isn't recommended.",
						id: "write_clientappsettings_btn",
						options: {
							type: "button",
							style: "outline",
						},
					},
				],
			},
			{
				name: "Advanced",
				description:
					"You shouldn't touch this unless you know what you're doing. This is more meant as a debugging tool.",
				id: "advanced",
				interactables: [
					{
						label: "Redirect console.logs to file",
						description:
							"Redirects every console.log(), console.error(), etc... to the Neutralino logs. Useful for finding bugs and errors.",
						id: "redirect_console",
						options: {
							type: "button",
							style: "destructive",
						},
					},
					{
						label: "Open logs file",
						description:
							"Opens the logs file in the preffered text editor.",
						id: "open_logs",
						options: {
							type: "button",
							style: "outline",
						},
					},
				],
			},
		],
	};
</script>

<Panel
	panel={panelOpts}
	on:buttonClicked={buttonClicked}
	on:settingsChanged={(e) => {
		settingsChanged(e.detail);
	}}
/>
