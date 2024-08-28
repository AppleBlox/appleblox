<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import type { SettingsPanel } from '@/types/settings';
	import { os, filesystem } from '@neutralinojs/lib';
	import { Book, Braces, BugOff, List, PictureInPicture, Play, Trash2 } from 'lucide-svelte';
	import path from 'path-browserify';
	import { toast } from 'svelte-sonner';
	import { clearLogs, disableConsoleRedirection, enableConsoleRedirection } from '../ts/debugging';
	import Roblox from '../ts/roblox';
	import { getRobloxPath } from '../ts/roblox/path';
	import { dataPath, saveSettings } from '../ts/settings';
	import { pathExists } from '../ts/utils';
	import Panel from './Settings/Panel.svelte';

	function settingsChanged(o: { [key: string]: any }) {
		saveSettings('misc', o);
	}

	let clearLogsPopup = false;

	async function buttonClicked(e: CustomEvent) {
		const id = e.detail;
		switch (id) {
			case 'redirect_console':
				enableConsoleRedirection();
				toast.success('Console redirection enabled', { duration: 1000 });
				break;
			case 'open_logs': {
				const logPath = path.join(path.dirname(await dataPath()), 'appleblox.log');
				if (!(await pathExists(logPath))) {
					toast.error("The logs file doesn't seem to exist.");
					return;
				}
				os.execCommand(`open "${logPath}"`).catch(console.error);
				break;
			}
			case 'clear_logs':
				clearLogsPopup = true;
				break;
		}
	}

	async function switchClicked(e: CustomEvent) {
		const { id, state } = e.detail;
		switch (id) {
			case 'redirect_console':
				if (state) {
					enableConsoleRedirection();
				} else {
					disableConsoleRedirection();
				}
				break;
		}
	}

	const panelOpts: SettingsPanel = {
		name: 'Misc',
		description: 'Various miscellaneous features and options',
		id: 'misc',
		sections: [
			{
				name: 'Other',
				description: "Features that don't really have a category.",
				id: 'advanced',
				interactables: [
					{
						label: 'Enable sound for all notifications',
						description: 'Will play a sound for every AppleBlox notification',
						id: 'notify_all',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Redirect console.logs to file',
						description: 'Redirects every console.log(), console.error(), etc... to the Neutralino logs. Useful for finding bugs and errors.',
						id: 'redirect_console',
						options: {
							type: 'boolean',
							state: true,
						},
					},
					{
						label: 'Open logs file',
						description: 'Opens the logs file in the preffered text editor.',
						id: 'open_logs',
						options: {
							type: 'button',
							style: 'outline',
							icon: {
								component: List,
							},
						},
					},
					{
						label: 'Clear logs',
						description: 'Clears the logs file',
						id: 'clear_logs',
						options: {
							type: 'button',
							style: 'destructive',
							icon: {
								component: Trash2,
							},
						},
					},
				],
			},
		],
	};
</script>

<AlertDialog.Root bind:open={clearLogsPopup}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
			<AlertDialog.Description>This action cannot be undone. This will permanently delete your logs.</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				on:click={() => {
					clearLogs()
						.then(() => {
							toast.success('The logs have been cleared');
						})
						.catch(() => {
							toast.error('An error occured while clearing the logs');
						});
				}}>Continue</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<Panel
	panel={panelOpts}
	on:buttonClicked={buttonClicked}
	on:switchClicked={switchClicked}
	on:settingsChanged={(e) => {
		settingsChanged(e.detail);
	}}
/>
