<script lang="ts">
	import { SettingsPanelBuilder } from '../settings';
	import Panel from '../settings/panel.svelte';
	import Editor from './editor.svelte';

	const panel = new SettingsPanelBuilder()
		.setName('Fast Flags')
		.setDescription('Control and unlock specific parts and features of Roblox')
		.setId('flags_editor')
		.addCategory((category) =>
			category.setId('general').addCustom({ component: Editor, id: 'editor', label: '', description: '' })
		)
		.build();
</script>

<Panel {panel} fadeIn={false} />
