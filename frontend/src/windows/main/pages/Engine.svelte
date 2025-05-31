<script lang="ts">
	import FlagEditor from '../components/flag-editor/flag-editor.svelte';
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';

	export let render = true;

	const panel = new SettingsPanelBuilder()
		.setName('Engine')
		.setDescription('Advanced Roblox engine and interface settings')
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
				})
				.addSlider({
					label: 'FPS Target',
					description:
						'Sets the maximum number of frames per second. <br><span style="color: hsl(var(--warning));">Requires the Vulkan graphics API (Option above).</span>',
					id: 'fps_target',
					default: [60],
					min: 1,
					max: 240,
					step: 1,
					toggleable: {
						id: 'engine',
						type: 'select',
						value: 'vulkan',
					},
				})
				.addSelect({
					label: 'Lighting Technology',
					description: 'Override game lighting technology',
					id: 'lightning',
					items: [
						{ label: 'Default', value: 'default' },
						{ label: 'Voxel', value: 'voxel' },
						{ label: 'ShadowMap', value: 'shadowmap' },
						{ label: 'Future', value: 'future' },
					],
					default: 'default',
				})
				.addSwitch({
					label: 'Disable Voxel Shadows',
					description:
						'Remove shadows when using Voxel lighting <br><span style="color: hsl(var(--warning));">Requires Voxel lightning (Option above).</span>',
					id: 'disable_voxel_shadows',
					default: false,
					toggleable: {
						id: 'lightning',
						type: 'select',
						value: 'voxel',
					},
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
					label: 'Visual Effects',
					description: 'Enable post-processing effects',
					id: 'postfx',
					default: true,
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
					label: 'Character Textures',
					description: 'Enable player textures',
					id: 'player_textures',
					default: true,
				})
				.addSwitch({
					label: 'Debug Skybox',
					description: 'Use simple gray sky for testing',
					id: 'debug_sky',
					default: false,
				})
		)
		.addCategory((category) =>
			category
				.setName('Interface')
				.setDescription('UI customization options')
				.setId('ui')
				.addSelect({
					label: 'Menu Style',
					description: 'Choose in-game menu version',
					id: 'menu_version',
					items: [
						{ label: 'Version 2 (2020)', value: 'v2' },
						{ label: 'Default (Chrome)', value: 'default' },
					],
					default: 'default',
				})
		)
		.addCategory((category) =>
			category
				.setName('Features')
				.setDescription('Additional functionality')
				.setId('utility')
				.addSwitch({
					label: 'GUI Shortcuts',
					description: `Keyboard shortcuts to toggle UI elements (You need to be in the <a href="https://www.roblox.com/groups/8699949/AppleBlox-enjoyers#!/about">AppleBlox group</a>):
                   </br>&nbspCMD + Shift + B: Toggles GUIs in 3D space (BillboardGuis, etc)
					</br>&nbspCMD + Shift + C: Toggles game-defined ScreenGuis
					</br>&nbspCMD + Shift + G: Toggles Roblox CoreGuis
					</br>&nbspCMD + Shift + N: Toggles player names, and other that shows...`,
					id: 'gui',
					default: false,
				})
				.addSwitch({
					label: 'Disable Telemetry',
					description: 'Disable Roblox analytics collection',
					id: 'telemetry',
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
