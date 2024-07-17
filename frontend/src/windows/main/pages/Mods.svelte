<script lang="ts">
	import type { SettingsPanel } from "@/types/settings";
	import Panel from "./Settings/Panel.svelte";
	import { os } from "@neutralinojs/lib";
	import path from "path-browserify";
	import { sleep } from "../ts/utils";
	import { toast } from "svelte-sonner";
	import { saveSettings } from "../ts/settings";

	function settingsChanged(o: { [key: string]: any }) {
		saveSettings("mods", o);
	}

	async function onButtonClicked(e: CustomEvent) {
		const buttonId = e.detail;
		switch (buttonId) {
			case "open_mods_folder":
				try {
					const folderPath = path.join(await os.getEnv("HOME"), "Library/AppleBlox/mods");
					await os.execCommand(`mkdir -p "${folderPath}"`);
					await sleep(10);
					await os.execCommand(`open "${folderPath}"`);
				} catch (err) {
					toast.error("An error occured: " + err);
					console.error(err);
				}
				break;
			case "join_bloxstrap":
				os.open("https://discord.gg/nKjV3mGq6R");
				break;
			case "mods_help":
				os.open("https://github.com/pizzaboxer/bloxstrap/wiki/Adding-custom-mods");
				break;
		}
	}

	const panelOpts: SettingsPanel = {
		name: "Mods",
		description: "Textures and other enhancement for the Roblox app",
		id: "mods",
		sections: [
			{
				name: "General",
				description:
					"Options about Roblox mods. To install mods, simply drag the files and folder you downloaded into AppleBlox's mods folder. To find mods, join the Bloxstrap Discord server. DO NOT ask help about AppleBlox there.",
				id: "general",
				interactables: [
					{
						label: "Open Mods folder",
						description: "Opens the Mods folder in Finder",
						id: "open_mods_folder",
						options: {
							type: "button",
							style: "default",
						},
					},
					{
						label: "Read the Mods Guide",
						description: "Adding mods in AppleBlox is the same as Bloxstrap. You just have to put in the correct AppleBlox folders.",
						id: "mods_help",
						options: {
							type: "button",
							style: "secondary",
						},
					},
					{
						label: "Join Bloxstrap Discord server",
						description: "Opens the Discord server invitation link (go to the #mods channel)",
						id: "join_bloxstrap",
						options: {
							type: "button",
							style: "outline",
						},
					},
					{
						label: "Enable Mods",
						description: "Enable/Disable your mods",
						id: "enable_mods",
						options: {
							type: "boolean",
							state: false,
						},
					},
					{
						label: "Fix Resolution",
						description: "Maximizes the resolution when opening Roblox. This fixes some icons not showing in some cases.",
						id: "spoof_res",
						options: {
							type: "boolean",
							state: false,
						},
					},
					{
						label: "Manage Mods",
						description: "internal",
						id: "mods_ui_space",
						hideTitle: true,
						options: {
							type: "mods_ui",
						},
					},
				],
			},
		],
	};
</script>

<Panel
	panel={panelOpts}
	on:buttonClicked={onButtonClicked}
	on:settingsChanged={(e) => {
		settingsChanged(e.detail);
	}}
/>
