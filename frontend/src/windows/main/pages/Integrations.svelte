<script lang="ts">
	import { app } from '@neutralinojs/lib';
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';

	export let render = true;

	async function onSwitchClicked(e: CustomEvent) {
		const { id, state } = e.detail;
		switch (id) {
			case 'window':
				if (!state) return;
				await app.writeProcessOutput('askPerm');
				app.readProcessInput();
				break;
		}
	}

	const panel = new SettingsPanelBuilder()
		.setName('Integrations')
		.setDescription('Configure AppleBlox integrations with Discord and Roblox')
		.setId('integrations')
		.addCategory((category) =>
			category.setName('Game Activity').setDescription('In-game information display').setId('activity').addSwitch({
				label: 'Server Location',
				description: "Display server's geographic location when joining games",
				id: 'notify_location',
				default: true,
			})
		)
		.addCategory((category) =>
			category
				.setName('Bloxstrap SDK')
				.setDescription('In-house implementation of Bloxstrap SDK for game developers')
				.setId('sdk')
				.addSwitch({
					label: 'Enable SDK',
					description: 'Enable Bloxstrap SDK compatibility features',
					id: 'enabled',
					default: false,
				})
				.addSwitch({
					label: 'Discord RPC Control',
					description: 'Allow games to customize your Discord presence',
					id: 'rpc',
					default: false,
					toggleable: {
						id: 'enabled',
						type: 'switch',
						value: true,
					},
				})
		)
		.addCategory((category) =>
			category
				.setName('Discord Rich Presence')
				.setDescription('Show your Roblox activity on Discord')
				.setId('rpc')
				.addSwitch({
					label: 'Enable Rich Presence',
					description: 'Display your game activity on Discord profile',
					id: 'enabled',
					default: true,
				})
				.addSwitch({
					label: 'Game Activity',
					description: "Show which game you're currently playing",
					id: 'activity',
					default: true,
					toggleable: {
						id: 'enabled',
						type: 'switch',
						value: true,
					},
				})
				.addSwitch({
					label: 'Play Time',
					description: "Display how long you've been playing",
					id: 'time',
					default: true,
					toggleable: {
						id: 'enabled',
						type: 'switch',
						value: true,
					},
				})
				.addSwitch({
					label: 'Join Button',
					description: 'Add a button for others to join your game session',
					id: 'joining',
					default: false,
					toggleable: {
						id: 'enabled',
						type: 'switch',
						value: true,
					},
				})
		)
		.build();
</script>

<Panel {panel} {render} on:switch={onSwitchClicked} />
