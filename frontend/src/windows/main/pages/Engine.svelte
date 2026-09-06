<script lang="ts">
	import FlagEditor from '../components/flag-editor/flag-editor.svelte';
	import MonitorSelector from '../components/monitor-selector.svelte';
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';

	export let render = true;

	const panel = new SettingsPanelBuilder()
		.setName('Engine')
		.setDescription(
			'Advanced Roblox engine and interface settings. <span style="color: hsl(var(--destructive));">Note: Many presets were removed due to the recent introduction of a fast flags allowlist by Roblox.</span>'
		)
		.setId('engine')
		.addCategory((category) =>
			category
				.setName('Frame Rate')
				.setDescription('Frame rate unlock and virtual display settings')
				.setId('graphics')
				.addSelect({
					label: 'Unlock Method',
					description: 'Method used to uncap the frame rate',
					id: 'fps_unlock',
					default: 'vsync',
					items: [
						{ label: 'VSync (default)', value: 'vsync' },
						{ label: 'Virtual Display', value: 'virtualdisplay' },
						{ label: 'OpenGL', value: 'opengl' },
					],
				})
				.addSlider({
					label: 'Refresh Rate',
					description: 'Refresh rate of the virtual display in Hz',
					id: 'vd_hz',
					default: [240],
					max: 600,
					min: 60,
					step: 1,
					warning: { above: 240, message: 'Degraded performance past 240Hz' },
					toggleable: {
						id: 'fps_unlock',
						type: 'select',
						value: 'virtualdisplay',
					},
				})
				.addInput({
					label: 'Custom Width',
					description: 'Override the virtual display width in pixels (leave empty for auto)',
					id: 'vd_width',
					default: '',
					placeholder: 'Auto',
					whitelist: '0123456789',
					toggleable: {
						id: 'fps_unlock',
						type: 'select',
						value: 'virtualdisplay',
					},
				})
				.addInput({
					label: 'Custom Height',
					description: 'Override the virtual display height in pixels (leave empty for auto)',
					id: 'vd_height',
					default: '',
					placeholder: 'Auto',
					whitelist: '0123456789',
					toggleable: {
						id: 'fps_unlock',
						type: 'select',
						value: 'virtualdisplay',
					},
				})
				.addCustom({
					label: '',
					description: '',
					id: 'vd_display',
					component: MonitorSelector,
					toggleable: {
						id: 'fps_unlock',
						type: 'select',
						value: 'virtualdisplay',
					},
				})
		)
		.addCategory((category) =>
			category
				.setName('Graphics Engine')
				.setDescription('Core graphics and performance settings')
				.setId('rendering')
				.addSelect({
					label: 'Graphics API',
					description: 'Select rendering backend',
					id: 'engine',
					default: 'default',
					items: [
						{ label: 'Default', value: 'default' },
						{ label: 'Metal', value: 'metal' },
						{ label: 'Vulkan', value: 'vulkan' },
						{ label: 'OpenGL', value: 'opengl' },
					],
				})
				.addSwitch({
					label: 'Separate Quality & Distance',
					description:
						'Split graphics quality from render distance (enables the slider below) <span style="color: hsl(var(--warning));">Be careful as some games like Apocalypse Rising 2 use older ways of loading objects, and setting this slider to 1 makes them unplayable.</span>',
					id: 'quality_distance_toggle',
					default: false,
				})
				.addSlider({
					label: 'Graphics Quality',
					description: 'Set base quality level (render distance controlled in-game)',
					id: 'quality_distance',
					default: [5],
					max: 21,
					min: 1,
					step: 1,
					toggleable: {
						id: 'quality_distance_toggle',
						type: 'switch',
						value: true,
					},
				})
				.addSwitch({
					label: 'Level-of-detail',
					description: 'Reduce detail for distant objects',
					id: 'lod',
					default: false,
				})
				.addSwitch({
					label: 'Fractional Scaling Fix',
					description: 'Render at full resolution when using fractional scaling',
					id: 'fracscaling',
					default: true,
				})
		)
		.addCategory((category) =>
			category
				.setName('Visual Quality')
				.setDescription('Texture and visual enhancement settings')
				.setId('visual')
				.addSwitch({
					label: 'Debug Skybox',
					description: 'Use simple gray sky for testing',
					id: 'debug_sky',
					default: false,
				})
		)
		.addCategory(
			(category) =>
				category.setName('Advanced').setDescription('Expert settings - use with caution').setId('advanced').addCustom({
					label: '',
					description: '',
					component: FlagEditor,
					id: 'fflags_editor',
				})
		)
		.build();
</script>

<Panel {panel} {render} />
