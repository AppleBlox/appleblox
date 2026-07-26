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
				.addSlider({
					label: 'Frame Rate Limit',
					description:
						'Set your max FPS (0 = default 60hz limit). Values above 60hz will create a virtual display to bypass macOS v-sync limits. (120hz is great for battery saving)',
					id: 'fps_limit',
					default: 0,
					min: 0,
					max: 240,
					step: 10,
				})
				// .addSelect({
				// 	label: 'Render Resolution',
				// 	description: 'Override the internal rendering resolution. Higher values produce sharper images but require more GPU power.',
				// 	id: 'resolution',
				// 	default: 'default',
				// 	items: [
				// 		{ label: 'Default', value: 'default' },
				// 		{ label: '8K (4320p)', value: '33178' },
				// 		{ label: '4K (2160p)', value: '8294' },
				// 		{ label: '1440p', value: '3686' },
				// 		{ label: '1080p', value: '2074' },
				// 		{ label: '720p', value: '922' },
				// 		{ label: '480p', value: '410' },
				// 	],
				// })
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
