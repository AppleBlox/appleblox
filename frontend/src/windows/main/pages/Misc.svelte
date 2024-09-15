<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { os } from '@neutralinojs/lib';
	import { Trash2, List } from 'lucide-svelte';
	import path from 'path-browserify';
	import { toast } from 'svelte-sonner';
	import { clearLogs, disableConsoleRedirection, enableConsoleRedirection } from '../ts/debugging';
	import { dataPath } from '../ts/settings';
	import { pathExists } from '../ts/utils';
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';

	let clearLogsPopup = false;

	async function buttonClicked(e: CustomEvent) {
		const { id } = e.detail;
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
				os.execCommand(`open -R "${logPath}"`).catch(console.error);
				break;
			}
			case 'clear_logs':
				clearLogsPopup = true;
				break;
			case 'open_folder':
				os.execCommand('open -R ~/"Library/Application Support/AppleBlox"/');
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

	const panel = new SettingsPanelBuilder()
		.setName('Miscellaneous')
		.setDescription("Other features that don't have their own tab")
		.setId('misc')
		.addCategory((category) =>
			category
				.setName('Other')
				.setDescription("Features that don't really have a category")
				.setId('advanced')
				.addSwitch({
					label: 'Enable sound for all notifications',
					description: 'Plays a sound for every AppleBlox notification',
					id: 'notify_all',
					default: false,
				})
				.addSwitch({
					label: 'Redirect logs to file',
					description:
						'Redirect every console.log(), etc... to the logs. Useful for finding bugs and errors (Recommended: ON)',
					id: 'redirect_console',
					default: true,
				})
				.addButton({
					label: 'Open logs file',
					description: 'Opens the logs file in finder',
					id: 'open_logs',
					variant: 'default',
					icon: { component: List },
				})
				.addButton({
					label: 'Clear logs',
					description: 'Clears the logs file',
					id: 'clear_logs',
					variant: 'destructive',
					icon: { component: Trash2 },
				})
				.addButton({
					label: 'Open AppleBlox folder',
					description: 'Opens the AppleBlox folder in Finder',
					id: 'open_folder',
					variant: 'outline',
				})
		)
		.build();
</script>

<AlertDialog.Root bind:open={clearLogsPopup}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
			<AlertDialog.Description
				>This action cannot be undone. This will permanently delete your logs.</AlertDialog.Description
			>
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

<Panel {panel} on:button={buttonClicked} on:switch={switchClicked} />
