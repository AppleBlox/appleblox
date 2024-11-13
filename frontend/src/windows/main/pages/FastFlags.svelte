<script lang="ts">
	import { Braces } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import FlagEditor from '../components/flag-editor/flag-editor.svelte';
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import Roblox from '../ts/roblox';

	export let render = true;

	async function onButtonClicked(e: CustomEvent) {
		const { id } = e.detail;
		switch (id) {
			case 'write_clientappsettings_btn':
				try {
					await Roblox.FFlags.writeClientAppSettings();
				} catch (err) {
					console.error('[FastFlagsPanel] ', err);
					toast.error('An error occured while writing ClientAppSettings.json');
				}
				break;
		}
	}

	const panel = new SettingsPanelBuilder()
		.setName('Fast Flags')
		.setDescription('Advanced Roblox engine and interface settings')
		.setId('fastflags')
		.addCategory((category) =>
			category
				.setName('Graphics Engine')
				.setDescription('Core graphics and performance settings')
				.setId('graphics')
				.addSlider({
					label: 'FPS Limit',
					description: 'Maximum frames per second',
					id: 'fps_target',
					default: [60],
					min: 1,
					max: 240,
					step: 1,
				})
				.addSelect({
					label: 'Graphics API',
					description: 'Select rendering backend',
					id: 'engine',
					default: 'default',
					items: [
						{ label: 'Default', value: 'default' },
						{ label: 'Metal', value: 'metal' },
						{ label: 'Vulkan (MoltenVK)', value: 'vulkan' },
						{ label: 'OpenGL (Intel)', value: 'opengl' },
					],
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
					description: 'Remove shadows when using Voxel lighting',
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
					description: 'Split graphics quality from render distance (enables the slider below) <span style="color: hsl(var(--warning));">Be careful as some games like Apocalypse Rising 2 use older ways of loading objects, and setting this slider to 1 makes them unplayable.</span>',
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
					label: '3D Grass',
					description: 'Enable detailed terrain grass',
					id: 'grass',
					default: true,
				})
				.addSwitch({
					label: 'World Shadows',
					description: 'Enable environmental shadows',
					id: 'shadows',
					default: true,
				})
				.addSwitch({
					label: 'Character Shadows',
					description: 'Enable player character shadows',
					id: 'player_shadows',
					default: true,
				})
				.addSwitch({
					label: 'Visual Effects',
					description: 'Enable post-processing effects',
					id: 'postfx',
					default: true,
				})
				.addSwitch({
					label: 'Anti-aliasing',
					description: 'Smooth and sharper edges',
					id: 'antialiasing',
					default: true,
				})
				.addSwitch({
					label: 'Level-of-detail',
					description: 'Reduce detail for distant objects',
					id: 'lod',
					default: false,
				})
				.addSwitch({
					label: 'Reduce lightning updates',
					description: 'Make the lightning update cycle slower',
					id: 'light_updates',
					default: false,
				})
		)
		.addCategory((category) =>
			category
				.setName('Visual Quality')
				.setDescription('Texture and visual enhancement settings')
				.setId('visual')
				.addSelect({
					label: 'Texture Quality',
					description: 'Set the texture detail level',
					id: 'textures_quality',
					items: [
						{ label: 'Default', value: 'default' },
						{ label: 'Ultra', value: '3' },
						{ label: 'High', value: '2' },
						{ label: 'Medium', value: '1' },
						{ label: 'Low', value: '0' },
					],
					default: 'default',
				})
				.addSwitch({
					label: 'Character Textures',
					description: 'Enable player textures',
					id: 'player_textures',
					default: true,
				})
				.addSwitch({
					label: 'Debug Skybox',
					description: 'Use a simple gray sky for testing',
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
						{ label: 'Version 1 (2015)', value: 'v1' },
						{ label: 'Version 2 (2020)', value: 'v2' },
						{ label: 'Version 4 (2023)', value: 'v4' },
						{ label: 'Version 4 (Chrome)', value: 'v4chrome' },
						{ label: 'Default', value: 'default' },
					],
					default: 'default',
				})
				.addSlider({
					label: 'UI Font Size',
					description: 'Adjust interface text size',
					id: 'font_size',
					default: [1],
					step: 1,
					max: 100,
					min: 1,
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
					description: 'Disable Roblox's analytics collection',
					id: 'telemetry',
					default: false,
				})
		)
		.addCategory((category) =>
			category
				.setName('Advanced')
				.setDescription('Expert settings - use with caution')
				.setId('advanced')
				.addCustom({
					label: '',
					description: '',
					component: FlagEditor,
					id: 'fflags_editor',
				})
				.addSwitch({
					label: 'Ignore FFlag Warnings',
					description: 'Suppress invalid flag notifications',
					id: 'ignore_flags_warning',
					default: false,
				})
				.addSeparator({ orientation: 'horizontal' })
				.addButton({
					label: 'Save FFlags to ClientAppSettings.json',
					description: 'Write flags directly to Roblox config (not recommended)',
					id: 'write_clientappsettings_btn',
					variant: 'outline',
					icon: { component: Braces },
				})
		)
		.build();
</script>

<Panel {panel} {render} on:button={onButtonClicked} />
