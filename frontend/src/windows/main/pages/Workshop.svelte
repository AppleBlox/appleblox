<script lang="ts">
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import Workshop from '../components/workshop/workshop.svelte';

	const panel = new SettingsPanelBuilder()
		.setName('Workshop')
		.setDescription('Download mods from the official AppleBlox repo')
		.setId('Workshop')
		.addCategory((category) =>
			category
				.setName('')
				.setDescription('')
				.setId('general')
				.addCustom({ label: '', description: '', id: 'theme_input', component: Workshop })
		)
		.build();
</script>

<Panel {panel} autosave={false} />
