<script lang="ts">
	import { LucideAArrowUp } from 'lucide-svelte';
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';

	const devPanel = new SettingsPanelBuilder()
		.setName('Dev Panel')
		.setDescription('A panel to test dev things.')
		.setId('dev')
		.addCategory((category) =>
			category
				.setName('Widgets')
				.setDescription('All possible widgets')
				.setId('widgets')
				.addButton({ label: 'Button', description: 'Button Widget', id: 'button', variant: 'default' })
				.addCustom({
					label: 'Custom',
					description: 'Custom Widget',
					id: 'custom',
					component: LucideAArrowUp,
				})
				.addEmpty({ label: 'Empty', description: 'Empty Widget', id: 'empty' })
				.addFilePicker({
					label: 'Filepicker All',
					description: 'Filepicker Widget (Accepts Anything)',
					id: 'filepicker_all',
				})
				.addFilePicker({
					label: 'Filepicker Png',
					description: 'Filepicker Widget (Accepts only Png)',
					id: 'filepicker_png',
					accept: ['png'],
				})
				.addInput({ label: 'Input', description: 'Input Widget', id: 'input', default: '', blacklist: '!?123' })
				.addSelect({
					label: 'Select',
					description: 'Select Widget',
					id: 'select',
					items: [
						{ label: 'Element one', value: 'one' },
						{ label: 'Another', value: 'another' },
					],
					default: 'one',
				})
				.addSlider({
					label: 'Slider',
					description: 'Slider Widget',
					id: 'slider',
					max: 100,
					min: 1,
					step: 1,
					default: [10],
				})
				.addSlider({
					label: 'Slider Step',
					description: 'Slider Step Widget',
					id: 'slider_step',
					max: 100,
					min: 1,
					step: 0.5,
					default: [10.5],
				})
				.addSwitch({ label: 'Switch', description: 'switch', id: 'switch', default: true })
				.addButton({
					label: 'Test toggle step',
					description: 'Requires Slider Step value [35.5]',
					id: 'slider_step_toggle_test',
					variant: 'default',
					toggleable: { id: 'slider_step', type: 'slider', value: [36.5] },
				})
				.addSelect({
					label: 'Test toggle input',
					description: 'Requires input value "balls"',
					id: 'select_toggle_test',
					items: [
						{ label: 'Default', value: 'default' },
						{ label: 'An option!!', value: 'option' },
					],
					default: 'default',
					toggleable: {
						id: 'input',
						type: 'input',
						value: 'balls',
					},
				})
		)
		.build();
</script>

<div>
	<Panel
		panel={devPanel}
	/>
	<h2>Args: "{window.NL_ARGS}"</h2>
</div>
