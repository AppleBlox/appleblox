<script lang="ts">
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import ThemeInput from '../components/theme-input/theme-input.svelte';
	import IconManager from '../components/icon-manager/icon-manager.svelte';
	import { toast } from 'svelte-sonner';
	import Logger from '../ts/utils/logger';
	import * as shellfs from '../ts/tools/shellfs';

	async function toggleNativeMode(enabled: boolean) {
		try {
			// window.NL_PATH already points to Resources directory
			const flagPath = `${window.NL_PATH}/bootstrap_native`;

			if (enabled) {
				// Create the flag file
				await shellfs.writeFile(flagPath, '');
				toast.success('Native dock mode enabled! Restart AppleBlox to see changes.');
				Logger.info('Enabled native dock mode');
			} else {
				// Remove the flag file
				try {
					await shellfs.remove(flagPath);
					toast.success('Native dock mode disabled! Restart AppleBlox to see changes.');
					Logger.info('Disabled native dock mode');
				} catch (e) {
					// File might not exist
					Logger.warn('Flag file does not exist:', e);
				}
			}
		} catch (error) {
			Logger.error('Failed to toggle native dock mode:', error);
			toast.error('Failed to change dock mode setting');
		}
	}

	const panel = new SettingsPanelBuilder()
		.setName('Appearance')
		.setDescription('Customize AppleBlox interface and app icon')
		.setId('appearance')
		.addCategory((category) =>
			category
				.setName('Theme')
				.setDescription('Customize app appearance')
				.setId('general')
				.addCustom({ label: '', description: '', id: 'theme_input', component: ThemeInput })
		)
		.addCategory((category) =>
			category.setName('Dock & Window').setDescription('Control how AppleBlox appears in macOS').setId('dock').addSwitch({
				label: 'Native Dock Mode',
				description:
					"Show AppleBlox bootstrap icon in dock instead of Neutralino. Enables custom icons, liquid glass effects, and better icon control. Window won't appear in Mission Control.",
				id: 'native_mode',
				default: false,
			})
		)
		.addCategory((category) =>
			category
				.setName('App Icon')
				.setDescription('Customize your AppleBlox app icon')
				.setId('icon')
				.addCustom({ label: '', description: '', id: 'icon_manager', component: IconManager })
		)
		.build();

	function handleSwitchChange(event: CustomEvent<{ id: string; state: boolean }>) {
		const { id, state } = event.detail;
		if (id === 'native_mode') {
			toggleNativeMode(state);
		}
	}
</script>

<Panel {panel} autosave={false} on:switch={handleSwitchChange} />
