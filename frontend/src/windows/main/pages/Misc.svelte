<script lang="ts">
import type {SettingsPanel} from '@/types/settings';
import Panel from './Settings/Panel.svelte';
import { saveSettings } from '../ts/settings';
	import { showNotification } from '../ts/notifications';

function settingsChanged(o: Object) {
	saveSettings("misc",o)
}

function buttonClicked(e: CustomEvent) {
	const id = e.detail	
	showNotification({
		title: "Button clicked",
		content: `Button id: ${id}`
	})
}

const panelOpts: SettingsPanel = {
	name: 'Misc',
	description: 'Various miscellaneous features and options',
	id: 'misc',
	sections: [
		{
			name: 'Multi Instances',
			description: "Makes it so multiple Roblox windows can be opnened at once.",
			id: 'multi_instances',
			interactables: [
				{
					label: 'Enable Multi Instances',
					description: 'Makes it so multiple Roblox windows can be opnened at once.',
					id: 'notify_location',
					options: {
						type: "button",
						style: "default",
					},
				}
			],
		}
	],
};
</script>

<Panel panel={panelOpts} on:buttonClicked={buttonClicked} on:settingsChanged={(e)=>{settingsChanged(e.detail)}}/>