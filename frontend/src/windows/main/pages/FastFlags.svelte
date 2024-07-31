<script lang="ts">
	import type { SettingsPanel } from '@/types/settings';
	import Panel from './Settings/Panel.svelte';
	import { saveSettings } from '../ts/settings';

	function settingsChanged(o: { [key: string]: any }) {
		saveSettings('fastflags', o);
	}

	const panelOpts: SettingsPanel = {
		name: 'Fast Flags',
		description: 'Configure certain details of the Roblox engine',
		id: 'fastflags',
		sections: [
			{
				name: 'Graphics',
				description: 'Flags about the graphics of Roblox',
				id: 'graphics',
				interactables: [
					{
						label: 'Framerate Limit',
						description: 'Uncaps the FPS to the selected value (Vulkan required).',
						id: 'ff_fps',
						options: {
							type: 'number',
							default: 60,
							min: 1,
							max: 300,
							step: 1,
						},
					},
					{
						label: 'Rendering Engine',
						description: 'Select the prefered Roblox rendering engine',
						id: 'ff_engine',
						options: {
							type: 'dropdown',
							list: [
								{ label: 'Metal', value: 'metal' },
								{ label: 'Vulkan (MoltenVK)', value: 'vulkan' },
								{ label: 'OpenGL (Intel)', value: 'opengl' },
							],
							default: { label: 'Metal', value: 'metal' },
						},
					},
					{
						label: 'Lightning Technology',
						description: 'Force the selected lightning technology across all games',
						id: 'ff_lightning',
						options: {
							type: 'dropdown',
							list: [
								{ label: 'Chosen by game', value: 'default' },
								{ label: 'Voxel', value: 'voxel' },
								{ label: 'ShadowMap', value: 'shadowmap' },
								{ label: 'Future', value: 'future' },
							],
							default: { label: 'Chosen by game', value: 'default' },
						},
					},
					{
						label: 'Disable shadows (Voxel lightning required)',
						description: 'Voxel shadows will be broken (disabled)',
						id: 'ff_voxel_shadows',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Force graphic value',
						description: '(Enables the option below)',
						id: 'ff_display_toggle',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Graphics quality w/ render distance',
						description: 'Choose a graphic value (slider in settings) to force. This lets you have a high render distance while keeping the same level of graphics.',
						id: 'ff_display',
						toggle: "ff_display_toggle",
						options: {
							type: 'number',
							default: 5,
							max: 10,
							min: 1,
							step: 1,
						},
					},
					{
						label: '1-21 steps graphics slider',
						description: 'Instead of having only 1-11 steps, you will be able to more accurately change your graphics',
						id: 'ff_graphics',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Disable terrain grass',
						description: '3D rendered grass will be disabled',
						id: 'ff_grass',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Disable shadows',
						description: 'Most shadows will be disabled',
						id: 'ff_shadows',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Disable player shadows',
						description: 'Player shadows will be disabled',
						id: 'ff_player_shadows',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Disable PostFX',
						description: 'Disables some effects (like sunrays)',
						id: 'ff_postfx',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Disable antialiasing',
						description: 'Edges will look less sharp',
						id: 'ff_antialiasing',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Lowers model polygons from far',
						description: 'Far objects will look less detailed',
						id: 'ff_polygons',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: "Don't update light often",
						description: 'Limits light updates',
						id: 'ff_light_updates',
						options: {
							type: 'boolean',
							state: false,
						},
					},
				],
			},
			{
				name: 'Visual',
				description: "Doesn't affect performance and is purely visual",
				id: 'visual',
				interactables: [
					{
						label: 'Disable textures',
						description: 'Remove every base Roblox textures (parts will be a flat solid color)',
						id: 'ff_textures',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Make textures low quality',
						description: 'Will reduce the resolutions of most textures',
						id: 'ff_lowquality',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Remove other players textures',
						description: 'Removes most textures of other players',
						id: 'ff_players_textures',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Enable debug sky',
						description: 'Enables gray sky with no clouds',
						id: 'ff_debug_sky',
						options: {
							type: 'boolean',
							state: false,
						},
					},
				],
			},
			{
				name: 'User Interface',
				description: 'Flags that modify the look of Roblox',
				id: 'ui',
				interactables: [
					{
						label: 'Menu version',
						description: 'Choose the version of the Roblox menu',
						id: 'ff_menu_version',
						options: {
							type: 'dropdown',
							default: { label: 'Default', value: 'default' },
							list: [
								{ label: 'Version 1 (2015)', value: 'v1' },
								{ label: 'Version 2 (2020)', value: 'v2' },
								{ label: 'Version 4 (2023)', value: 'v4' },
								{ label: 'Version 4 (Chrome)', value: 'v4chrome' },
								{ label: 'Default', value: 'default' },
							],
						},
					},
					{
						label: 'Custom font size',
						description: 'Changes the font size',
						id: 'ff_font_size',
						options: {
							type: 'number',
							default: 1,
							min: 1,
							max: 100,
							step: 1,
						},
					},
					{
						label: 'Use old font',
						description: 'Revert BuilderFont',
						id: 'ff_old_font',
						options: {
							type: 'boolean',
							state: false,
						},
					},
				],
			},
			{
				name: 'Utility',
				description: 'Useful features behind flags',
				id: 'utility',
				interactables: [
					{
						label: 'Hide GUI',
						description: `Input the ID of any group you're in. Defaults to Ori's group Paper4win.
						</br>&nbspCMD + Shift + B: Toggles GUIs in 3D space (BillboardGuis, etc)
						</br>&nbspCMD + Shift + C: Toggles game-defined ScreenGuis
						</br>&nbspCMD + Shift + G: Toggles Roblox CoreGuis
						</br>&nbspCMD + Shift + N: Toggles player names, and other that shows...`,
						id: 'ff_gui',
						options: {
							type: 'string',
							default: '8699949',
						},
					},
					{
						label: 'Semi-fullbright',
						description: 'Tries to make the dark places of the game as bright as possible (see in the dark)',
						id: 'ff_fullbright',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Disable telemetry',
						description: 'Tries to block all data about you that is sent to Roblox',
						id: 'ff_telemetry',
						options: {
							type: 'boolean',
							state: true,
						},
					},
				],
			},
			{
				name: 'Advanced',
				description: 'Advanced editing of Roblox fast flags',
				id: 'advanced',
				interactables: [
					{
						label: 'FFlags Buttons',
						description: 'Not shown',
						id: 'fflags_btns',
						options: {
							type: 'ff_buttons_custom',
						},
					},
				],
			},
		],
	};
</script>

<Panel
	panel={panelOpts}
	on:settingsChanged={(e) => {
		settingsChanged(e.detail);
	}}
/>
