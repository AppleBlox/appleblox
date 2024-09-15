<script lang="ts">
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import FfButtonsCustom from './Custom/FFButtonsCustom.svelte';

	const panel = new SettingsPanelBuilder()
		.setName('Fast Flags')
		.setDescription('Control and unlock specific parts and features of Roblox')
		.setId('fastflags')
		.addCategory((category) =>
			category
				.setName('Graphics')
				.setDescription('Flags related to the Roblox engine')
				.setId('graphics')
				.addSlider({
					label: 'Framerate Cap',
					description: 'Sets the FPS cap to this value',
					id: 'ff_fps',
					default: [60],
					min: 1,
					max: 300,
					step: 1,
				})
				.addSelect({
					label: 'Rendering Engine',
					description: 'Forces Roblox to use the selected rendering engine',
					id: 'ff_engine',
					default: 'default',
					items: [
						{ label: 'Default', value: 'default' },
						{ label: 'Metal', value: 'metal' },
						{ label: 'Vulkan (MoltenVK)', value: 'vulkan' },
						{ label: 'OpenGL (Intel)', value: 'opengl' },
					],
				})
				.addSelect({
					label: 'Lightning Technology',
					description: 'Forces the selected lightning technology across all games',
					id: 'ff_lightning',
					items: [
						{ label: 'Chosen by game', value: 'default' },
						{ label: 'Voxel', value: 'voxel' },
						{ label: 'ShadowMap', value: 'shadowmap' },
						{ label: 'Future', value: 'future' },
					],
					default: 'default',
				})
				.addSwitch({
					label: 'Disable shadows (Voxel lightning required)',
					description: 'Disables shadow when voxel lightning is active',
					id: 'ff_voxel_shadows',
					default: false,
					toggleable: {
						id: 'ff_lightning',
						type: 'select',
						value: 'voxel',
					},
				})
				.addSwitch({
					label: 'Enable graphics quality w/ render distance',
					description: '(Enables the option below)',
					id: 'ff_display_toggle',
					default: false,
				})
				.addSlider({
					label: 'Graphics quality w/ render distance',
					description:
						'Forces the graphic setting to this value. The graphics slider in the Roblox settings will now only control the Render distance',
					id: 'ff_display',
					default: [5],
					max: 10,
					min: 1,
					step: 1,
					toggleable: {
						id: 'ff_display_toggle',
						type: 'switch',
						value: true,
					},
				})
				.addSwitch({ label: 'Terrain grass', description: 'Render 3D grass', id: 'ff_grass', default: true })
				.addSwitch({ label: 'Shadows', description: 'Show (most) shadows', id: 'ff_shadows', default: true })
				.addSwitch({
					label: 'Player shadows',
					description: 'Show player shadows',
					id: 'ff_player_shadows',
					default: true,
				})
				.addSwitch({ label: 'PostFX', description: 'Render effects (like sunrays)', id: 'ff_postfx', default: true })
				.addSwitch({
					label: 'Anti-aliasing',
					description: 'Enables anti-aliasing to remove blurry edges',
					id: 'ff_antialiasing',
					default: true,
				})
				.addSwitch({
					label: 'Level-of-detail',
					description: 'Renders far objects with less polygons',
					id: 'ff_polygons',
					default: false,
				})
				.addSwitch({
					label: 'Limit light updates',
					description: 'Lightning in games will update less often',
					id: 'ff_light_updates',
					default: false,
				})
		)
		.addCategory((category) =>
			category
				.setName('Visual')
				.setDescription("Doesn't affect performance and is purely visual")
				.setId('visual')
				.addSelect({
					label: 'Textures quality',
					description: 'Changes the textures quality',
					id: 'ff_textures_quality',
					items: [
						{ label: 'Default', value: 'default' },
						{ label: 'Level 3', value: '3' },
						{ label: 'Level 2', value: '2' },
						{ label: 'Level 1', value: '1' },
						{ label: 'Level 0', value: '0' },
					],
					default: 'default',
				})
				.addSwitch({
					label: 'Flat textures',
					description: 'Disables every default Roblox textures (parts will be a flat solid color)',
					id: 'ff_textures',
					default: false,
				})
				.addSwitch({
					label: 'Player textures',
					description: 'Renders player textures',
					id: 'ff_players_textures',
					default: true,
				})
				.addSwitch({
					label: 'Debug Sky',
					description: 'Enables the debugging sky (gray w/ no clouds)',
					id: 'ff_debug_sky',
					default: false,
				})
		)
		.addCategory((category) =>
			category
				.setName('User Interface')
				.setDescription('Flags that modify the UI of Roblox')
				.setId('ui')
				.addSelect({
					label: 'Menu version',
					description: 'Selects which menu should be shown when pressing ESC in-game',
					id: 'ff_menu_version',
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
					label: 'Font size',
					description: 'Defines a custom font size to apply in the app',
					id: 'ff_font_size',
					default: [1],
					step: 1,
					max: 100,
					min: 1,
				})
		)
		.addCategory((category) =>
			category
				.setName('Utility')
				.setDescription('Useful flags & others')
				.setId('utility')
				.addSwitch({
					label: 'Hide GUI',
					description: `Hides some part of the UI using keyboard shortcuts. You must join the <a href="https://www.roblox.com/groups/8699949/AppleBlox-enjoyers#!/about">Appleblox Roblox group.</a>
						</br>&nbspCMD + Shift + B: Toggles GUIs in 3D space (BillboardGuis, etc)
						</br>&nbspCMD + Shift + C: Toggles game-defined ScreenGuis
						</br>&nbspCMD + Shift + G: Toggles Roblox CoreGuis
						</br>&nbspCMD + Shift + N: Toggles player names, and other that shows...`,
					id: 'ff_gui',
					default: false,
				})
				.addSwitch({
					label: 'Disable telemetry',
					description: 'Prevent the app from sending your data to Roblox',
					id: 'ff_telemetry',
					default: false,
				})
				.addCustom({label: "Flags editor", description: "Advanced editing of fast flags", component: FfButtonsCustom, id: "fflags_editor"})
		)
		.build();
</script>

<Panel {panel} />
