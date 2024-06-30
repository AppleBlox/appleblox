<script lang="ts">
import type {SettingsPanel} from '@/types/settings';
import Panel from './Settings/Panel.svelte';

import {saveSettings} from '../ts/settings';
import { os } from '@neutralinojs/lib';

function settingsChanged(o: Object) {
	saveSettings('fastflags', o);
}

const panelOpts: SettingsPanel = {
	name: 'Fast Flags',
	description: 'Configure certain details of the Roblox engine',
	id: 'fastflags',
	sections: [
		{
			name: 'Presets',
			description: 'Already made and easily togglable FFlags',
			id: 'presets',
			interactables: [
				{
					label: 'Framerate Limit',
					description: 'A value between 1 and 9999 (Uncap FPS)',
					id: 'ff_fps',
					options: {
						type: 'number',
						default: 60,
						min: 1,
						max: 9999,
						step: 1,
					},
				},
				{
					label: 'Lightning Technology',
					description: 'Force the selected lightning technology across all games',
					id: 'ff_lightning',
					options: {
						type: 'dropdown',
						list: [
                            {label: "Chosen by game",value:"default"},
                            {label: "Voxel",value:"voxel"},
                            {label: "ShadowMap",value:"shadowmap"},
                            {label: "Future",value:"future"}
                    ],
						default: {label: "Chosen by game",value:"default"},
					},
				},
				{
					label: 'Rendering Engine',
					description: 'Select the prefered Roblox rendering engine',
					id: 'ff_engine',
					options: {
						type: 'dropdown',
						list: [
							{label: 'Metal', value: 'metal'},
							{label: 'Vulkan (MoltenVK)', value: 'vulkan'},
							{label: 'OpenGL (Intel)', value: 'opengl'},
						],
						default: {label: 'Metal', value: 'metal'},
					},
				},
				{
					label: 'Hide GUI',
					description: `Input the ID of any group you're in. Defaults to Ori's group Paper4win.
						</br>&nbspCMD + Shift + B: Toggles GUIs in 3D space (BillboardGuis, etc)
						</br>&nbspCMD + Shift + C: Toggles game-defined ScreenGuis
						</br>&nbspCMD + Shift + G: Toggles Roblox CoreGuis
						</br>&nbspCMD + Shift + N: Toggles player names, and other that shows...`,
					id: 'ff_gui',
					options: {
						type: "string",
						default: "8699949"
					},
				},
				{
					label: 'Preserve quality with graphics slider',
					description:
						'Instead of reducing the render distance and quality, this option will only reduce the render distance',
					id: 'ff_display',
					options: {
						type: 'boolean',
						state: false,
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
			],
		},
		{
            name: "Advanced",
            description: "Advanced editing of Roblox fast flags",
            id: "advanced",
            interactables: [
                {
                    label: "FFlags Buttons",
                    description: "Not shown",
                    id: "fflags_btns",
                    options: {
                        type: "ff_buttons_custom",
                    }
                }
            ]
        }
	],
};
</script>

<Panel
	panel={panelOpts}
	on:settingsChanged={(e) => {
		settingsChanged(e.detail);
	}} />
