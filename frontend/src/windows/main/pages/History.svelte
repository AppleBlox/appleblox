<script lang="ts">
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import HistoryContent from '../components/history/history-content.svelte';

	export let render = true;

	const panel = new SettingsPanelBuilder()
		.setName('History')
		.setId('history')
		.setDescription('Track and view your recently played games')
		.addCategory((category) =>
			category
				.setName('Tracking')
				.setDescription('Control game history recording')
				.setId('tracking')
				.addSwitch({
					label: 'Enable Tracking',
					description: 'Record games and servers you join (max 30 games, 10 servers each)',
					id: 'enabled',
					default: true,
				})
		)
		.addCategory((category) =>
			category.setId('games').setHideSeparator(true).addCustom({
				label: '',
				description: '',
				id: 'history_content',
				component: HistoryContent,
			})
		)
		.build();
</script>

<Panel {panel} {render} />
