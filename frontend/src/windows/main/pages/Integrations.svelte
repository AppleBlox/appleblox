<script lang="ts">
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';

	const panel = new SettingsPanelBuilder()
		.setName('Integrations')
		.setDescription('Configure various integrations between AppleBlox and apps like Discord or Roblox.')
		.setId('integrations')
		.addCategory((category) =>
			category
				.setName('Activity')
				.setDescription('Features related to your in-game activity.')
				.setId('activity')
				.addSwitch({
					label: 'Server details',
					description: "Will show your server's details when joining a game",
					id: 'notify_location',
					default: true,
				})
		)
		.addCategory((category) =>
			category
				.setName('Bloxstrap SDK')
				.setDescription('In-house implementation of the Bloxstrap SDK')
				.setId('sdk')
				.addSwitch({
					label: 'Enable SDK',
					description: 'Re-implements the features of the Bloxstrap SDK',
					id: 'enabled',
					default: false,
				})
				.addSwitch({
					label: 'Control RPC',
					description: 'Games can change your discord RPC',
					id: 'sdk_rpc',
					default: false,
				})
				.addSwitch({
					label: 'Control Roblox window',
					description: "Games can change your Roblox window's size, position, etc...",
					id: 'window',
					default: false,
				})
		)
		.addCategory((category) =>
			category
				.setName('Discord Riche Presence')
				.setDescription("Show information about what you're playing on your Discord profile")
				.setId('rpc')
				.addSwitch({
					label: 'Enable RPC',
					description: 'Enables the custom Discord rich presence',
					id: 'enable_rpc',
					default: true,
				})
				.addSwitch({
					label: 'Show game activity',
					description: "Shows the game you're playing on your profile",
					id: 'rpc_activity',
					default: true,
				})
				.addSwitch({
					label: 'Show game time',
					description: 'Show the time since you started playing a game',
					id: 'rpc_time',
					default: true,
				})
				.addSwitch({
					label: 'Allow joining',
					description: `Adds a "join" button on your profile which let\'s people join your game'`,
					id: 'rpc_join',
					default: false,
				})
		)
		.build();
</script>

<Panel
	{panel}
/>
