<script lang="ts">
	import type { SettingsPanel } from "@/types/settings";
	import Panel from "./Settings/Panel.svelte";
	import { loadSettings, saveSettings } from "../ts/settings";
	import { createRPC, terminateRPC } from "../ts/rpc";

	async function loadRPC(settings?: { [key: string]: any }) {
		let o = settings;
		if (o == null) {
			o = await loadSettings("integrations")
			if (o == null) {
				return;
			}
		}
		if (o.rpc.rpc_activity) {
			await createRPC({
				details: "Browsing the menus",
				state: "Beta",
				large_image: "appleblox",
				large_image_text: "AppleBlox Logo",
			});
		} else {
			await terminateRPC();
		}
	}

	function settingsChanged(o: { [key: string]: any }) {
		saveSettings("integrations", o);
		loadRPC(o)
	}

	const panelOpts: SettingsPanel = {
		name: "Integrations",
		description: "Configure the integrations between AppleBlox and various apps like Discord with Roblox",
		id: "integrations",
		sections: [
			{
				name: "Activity Notifications",
				description: "Notifications about the game you're playing & your server location",
				id: "activity",
				interactables: [
					{
						label: "See server location when joining a game",
						description: "You will be notified of your current server location (EU, US, etc..)",
						id: "notify_location",
						options: {
							type: "boolean",
							state: true,
						},
					},
					{
						label: "See current place when teleporting",
						description:
							"When you teleport (or join) a place, you will be notified of its name and other informations",
						id: "notify_place",
						options: {
							type: "boolean",
							state: false,
						},
					},
					{
						label: "Enable Bloxstrap SDK compatibility",
						description: "Activate a compatibility layer which tries to support every functions of the Bloxstrap SDK",
						id: "bloxstrap_sdk",
						options: {
							type: "boolean",
							state: false,
						},
					},
				],
			},
			{
				name: "Discord Rich Presence",
				description: "Show information about what you're playing on Discord",
				id: "rpc",
				interactables: [
					{
						label: "Show game activity",
						description: "Shows the game you're playing on your profile",
						id: "rpc_activity",
						options: {
							type: "boolean",
							state: true,
						},
					},
					{
						label: "Show game time",
						description: "Show the time since you started playing Roblox",
						id: "rpc_time",
						options: {
							type: "boolean",
							state: true,
						},
					},
					{
						label: "Allow joining",
						description: "Allow friends / everyone (depends on your roblox settings) to join you in-game",
						id: "rpc_join",
						options: {
							type: "boolean",
							state: false,
						},
					},
				],
			},
		],
	};
</script>

<Panel
	panel={panelOpts}
	on:settingsChanged={(e) => {
		settingsChanged(e.detail);
	}}
/>
