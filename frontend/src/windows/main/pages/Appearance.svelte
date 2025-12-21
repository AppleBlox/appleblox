<script lang="ts">
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import ThemeInput from '../components/theme-input/theme-input.svelte';
	import IconManager from '../components/icon-manager/icon-manager.svelte';

	const panel = new SettingsPanelBuilder()
		.setName('Appearance')
		.setDescription('Customize AppleBlox interface and app icon')
		.setId('appearance')
		.addCategory((category) =>
			category
				.setName('App Icon')
				.setDescription('Customize your AppleBlox app icon')
				.setId('icon')
				.addCustom({ label: '', description: '', id: 'icon_manager', component: IconManager })
		)
		.addCategory((category) =>
			category
				.setName('Theme')
				.setDescription('Customize app appearance')
				.setId('general')
				.addCustom({ label: '', description: '', id: 'theme_input', component: ThemeInput })
		)
		.build();
</script>

<Panel {panel} autosave={false} />
