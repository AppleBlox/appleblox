<script lang="ts">
	import type { SettingsPanel } from "@/types/settings";
	import Panel from "./Settings/Panel.svelte";
	import { loadSettings, saveSettings } from "../ts/settings";
	import { DiscordRPC } from "../ts/rpc";
	import { os } from "@neutralinojs/lib";

	let rpc: DiscordRPC | null = null;

	async function loadRPC(settings?: { [key: string]: any }) {
		if (settings == null) {
			settings = await loadSettings("integrations");
			if (settings == null) {
				return;
			}
		}
		if (settings.rpc.enable_rpc) {
			if (!rpc) {
				rpc = new DiscordRPC();
			}
			await rpc
				.start({
					clientId: "1257650541677383721",
					details: "Currently in the launcher",
					state: "using AppleBlox",
					largeImage: "appleblox",
					largeImageText: "AppleBlox Logo",
					enableTime: true,
				})
				.catch(console.error);
		} else if (rpc) {
			await rpc.destroy();
			rpc = null;
		}
	}

	function settingsChanged(o: { [key: string]: any }) {
		saveSettings("integrations", o);
		loadRPC(o);
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
					/*{
						label: "See current place when teleporting",
						description: "When you teleport (or join) a place, you will be notified of its name and other informations",
						id: "notify_place",
						options: {
							type: "boolean",
							state: false,
						},
					},*/
				],
			},
			{
				name: "Bloxstrap SDK",
				description: "Replica of the Bloxstrap SDK. Makes it so games can control certain aspect of your Roblox instance",
				id: "sdk",
				interactables: [
					{
						label: "Enable SDK",
						description: "Activate a compatibility layer which tries to support every functions of the Bloxstrap SDK",
						id: "enabled",
						options: {
							type: "boolean",
							state: false,
						},
					},
					{
						label: "Control RPC",
						description: "Games can change your DiscordRPC",
						id: "sdK_rpc",
						options: {
							type: "boolean",
							state: false,
						},
					},
					{
						label: "Control Roblox window",
						description: "Games can define the size of your Roblox window",
						id: "window",
						options: {
							type: "boolean",
							state: false,
						},
					},
				]
			},
			{
				name: "Discord Rich Presence",
				description: "Show information about what you're playing on Discord",
				id: "rpc",
				interactables: [
					{
						label: "Enable RPC",
						description: "Whether to enable or disable the Discord RPC",
						id: "enable_rpc",
						options: {
							type: "boolean",
							state: true,
						},
					},
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
