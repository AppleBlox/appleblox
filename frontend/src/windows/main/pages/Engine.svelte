<script lang="ts">
	import FlagEditor from '../components/flag-editor/flag-editor.svelte';
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
				.setName('Graphics Engine')
				.setDescription('Core graphics and performance settings')
				.setId('graphics')
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
					toggleable: {
						id: 'fps_cap',
						type: 'switch',
						value: false,
					},
				})
				.addSwitch({
					label: 'Remove frame rate limit',
					description:
						'Removes the limit of 60 frames per second imposed by MacOS (You will have to use the built-in FPS changer in Roblox in addition of this option). <br><span style="color: hsl(var(--warning));">This option is unstable as it requires the old and unspported OpenGL graphics API. You will probably get worse performance than when using Metal.</span>',
					id: 'fps_cap',
					default: false,
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
					max: 10,
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
			// .addSwitch({
			// 	label: 'Ignore Flag Warnings',
			// 	description: 'Suppress invalid flag notifications',
			// 	id: 'ignore_flags_warning',
			// 	default: false,
			// })
		)
		.build();
</script>

<Panel {panel} {render} />
