<script lang="ts">
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import ThemeInput from '../components/theme-input/theme-input.svelte';

	const panel = new SettingsPanelBuilder()
		.setName('Appearance')
		.setDescription('Customize AppleBlox's interface')
		.setId('appearance')
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
