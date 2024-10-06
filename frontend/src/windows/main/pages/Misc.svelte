<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { os } from '@neutralinojs/lib';
	import { Trash2, List } from 'lucide-svelte';
	import path from 'path-browserify';
	import { toast } from 'svelte-sonner';
	import { clearLogs, disableConsoleRedirection, enableConsoleRedirection } from '../ts/debugging';
	import { SettingsPanelBuilder, getConfigPath } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import shellFS from '../ts/tools/shellfs';
	import Roblox from '../ts/roblox';

	export let render = true;

	let clearLogsPopup = false;

	async function buttonClicked(e: CustomEvent) {
		const { id } = e.detail;
		switch (id) {
			case 'redirect_console':
				enableConsoleRedirection();
				toast.success('Console redirection enabled', { duration: 1000 });
				break;
			case 'open_logs': {
				const logPath = path.join(path.dirname(await getConfigPath()), 'appleblox.log');
				if (!(await shellFS.exists(logPath))) {
					toast.error("The logs file doesn't seem to exist.");
					return;
				}
				shellFS.open(logPath, { reveal: true });
				break;
			}
			case 'clear_logs':
				clearLogsPopup = true;
				break;
			case 'open_folder':
				shellFS.open(path.join(await os.getEnv('HOME'), 'Library', 'Application Support', 'AppleBlox'), { reveal: true });
				break;
			case 'open_roblox_folder':
				shellFS.open(path.join(Roblox.path, 'Contents'), { reveal: true });
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
				.addButton({
					label: 'Open Roblox app folder',
					description: 'Opens the Roblox.app folder in Finder',
					id: 'open_roblox_folder',
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

<Panel {panel} on:button={buttonClicked} on:switch={switchClicked} {render} />
