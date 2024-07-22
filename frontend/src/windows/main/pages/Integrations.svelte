<script lang="ts">
	import type { SettingsPanel } from '@/types/settings';
	import Panel from './Settings/Panel.svelte';
	import { loadSettings, saveSettings } from '../ts/settings';
	import { RPCController } from '../ts/rpc';

	async function loadRPC(settings?: { [key: string]: any }) {
		if (settings == null) {
			settings = await loadSettings('integrations');
			if (settings == null) {
				return;
			}
		}
		if (!settings.rpc.enable_rpc) {
			await RPCController.stop();
		}
	}

	function settingsChanged(o: { [key: string]: any }) {
		saveSettings('integrations', o);
		loadRPC(o);
	}

	const panelOpts: SettingsPanel = {
		name: 'Integrations',
		description: 'Configure the integrations between AppleBlox and various apps like Discord with Roblox',
		id: 'integrations',
		sections: [
			{
				name: 'Activity Notifications',
				description: "Notifications about the game you're playing & your server location",
				id: 'activity',
				interactables: [
					{
						label: 'See server location when joining a game',
						description: 'You will be notified of your current server location (EU, US, etc..)',
						id: 'notify_location',
						options: {
							type: 'boolean',
							state: true,
						},
					},
				],
			},
			{
				name: 'Bloxstrap SDK',
				description: 'Replica of the Bloxstrap SDK. Makes it so games can control certain aspect of your Roblox instance',
				id: 'sdk',
				interactables: [
					{
						label: 'Enable SDK',
						description: 'Activate a compatibility layer which tries to support every functions of the Bloxstrap SDK',
						id: 'enabled',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Control RPC',
						description: 'Games can change your DiscordRPC',
						id: 'sdk_rpc',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Control Roblox window',
						description: 'Games can define the size of your Roblox window',
						id: 'window',
						options: {
							type: 'boolean',
							state: false,
						},
					},
				],
			},
			{
				name: 'Discord Rich Presence',
				description: "Show information about what you're playing on Discord",
				id: 'rpc',
				interactables: [
					{
						label: 'Enable RPC',
						description: 'Whether to enable or disable the Discord RPC',
						id: 'enable_rpc',
						options: {
							type: 'boolean',
							state: true,
						},
					},
					{
						label: 'Show game activity',
						description: "Shows the game you're playing on your profile",
						id: 'rpc_activity',
						options: {
							type: 'boolean',
							state: true,
						},
					},
					{
						label: 'Show game time',
						description: 'Show the time since you started playing Roblox',
						id: 'rpc_time',
						options: {
							type: 'boolean',
							state: true,
						},
					},
					{
						label: 'Allow joining',
						description: 'Allow friends / everyone (depends on your roblox settings) to join you in-game',
						id: 'rpc_join',
						options: {
							type: 'boolean',
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
