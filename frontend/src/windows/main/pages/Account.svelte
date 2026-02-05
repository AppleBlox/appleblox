<script lang="ts">
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import RegionSettings from '../components/roblox/region-settings.svelte';

	export let render = true;

	const panel = new SettingsPanelBuilder()
		.setName('Account')
		.setDescription('Manage your Roblox account connection and region preferences')
		.setId('account')
		.addCategory((category) =>
			category
				.setName('Roblox Account')
				.setDescription('Connect your Roblox account to enable advanced features')
				.setId('roblox_account')
				.addCustom({
					component: RegionSettings,
					id: 'account_settings',
					label: '',
					description: '',
				})
		)
		.build();
</script>

<Panel {panel} {render} />
