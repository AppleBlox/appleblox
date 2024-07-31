<script lang="ts">
	import type { SettingsPanel } from '@/types/settings';
	import Panel from './Settings/Panel.svelte';
	import { dataPath, loadSettings, saveSettings } from '../ts/settings';
	import { toast } from 'svelte-sonner';
	import { filesystem, os } from '@neutralinojs/lib';
	import path from 'path-browserify';
	import { pathExists } from '../ts/utils';
	import { clearLogs, disableConsoleRedirection, enableConsoleRedirection } from '../ts/debugging';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { getRobloxPath } from '../ts/roblox/path';
	import Roblox from '../ts/roblox';
	import { Book, Braces, BugOff, List, PictureInPicture, Play, Trash2 } from 'lucide-svelte';
	import { libraryPath } from '../ts/libraries';

	// Check for URL scheme (better solution?)
	// let settingsLoaded = false
	// $: if (settingsLoaded) {
	// 	(async()=>{
	// 		let settings = await loadSettings("misc")
	// 		if (!settings) return;
	// 		const cmd = await os.execCommand(`${libraryPath("urlscheme")} check roblox ch.origaming.appleblox.url`)
	// 		console.debug(cmd)
	// 		settings.roblox_launching.use_roblox_url = cmd.stdOut.includes("true")
	// 		saveSettings("misc",settings)
	// 	})();
	// }

	function settingsChanged(o: { [key: string]: any }) {
		// settingsLoaded = true
		saveSettings('misc', o);
	}

	let clearLogsPopup = false;

	async function buttonClicked(e: CustomEvent) {
		const id = e.detail;
		switch (id) {
			case 'multi_roblox_btn':
				await Roblox.Utils.enableMultiInstance();
				break;
			case 'open_instance_btn':
				os.spawnProcess(`${path.join(getRobloxPath(), 'Contents/MacOS/RobloxPlayer')}; exit`);
				break;
			case 'close_roblox_btn':
				await os.execCommand(`ps aux | grep -i roblox | grep -v grep | awk '{print $2}' | xargs kill -9`);
				toast.success('All Roblox Instances have been closed.');
				break;
			case 'create_shortcut_btn':
				try {
					await Roblox.Utils.createShortcut();
				} catch (err) {
					console.error(err);
					toast.error('An error occured while trying to save the shortcut', { duration: 2000 });
					return;
				}
				break;
			case 'write_clientappsettings_btn':
				try {
					const filePath = path.join(getRobloxPath(), 'Contents/MacOS/ClientSettings/AppClientSettings.json');
					if (await pathExists(filePath)) {
						await filesystem.remove(filePath);
					}
					await filesystem.createDirectory(path.dirname(filePath));
					const fflags = { ...(await Roblox.FFlags.parseFlags(false)), ...(await Roblox.FFlags.parseFlags(true)) };
					await filesystem.writeFile(filePath, JSON.stringify(fflags));
					toast.success(`Wrote ClientAppSettings at "${filePath}"`);
				} catch (err) {
					console.error(err);
					toast.error('An error occured while writing ClientAppSettings.json');
				}
				break;
			case 'redirect_console':
				enableConsoleRedirection();
				toast.success('Console redirection enabled', { duration: 1000 });
				break;
			case 'open_logs':
				const logPath = path.join(path.dirname(await dataPath()), 'appleblox.log');
				if (!(await pathExists(logPath))) {
					toast.error("The logs file doesn't seem to exist.");
					return;
				}
				os.execCommand(`open "${logPath}"`).catch(console.error);
				break;
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
			case 'use_roblox_url':
				console.log(state)
				Roblox.Utils.toggleURI(state).catch((err) => {
					toast.error('An error occured');
					console.error(err);
				});
		}
	}
	
	const panelOpts: SettingsPanel = {
		name: 'Misc',
		description: 'Various miscellaneous features and options',
		id: 'misc',
		sections: [
			{
				name: 'Multi Instances',
				description: 'Makes it so multiple Roblox windows can be opnened at once.',
				id: 'multi_instances',
				interactables: [
					{
						label: 'Enable Multi Instances',
						description: 'Makes it so multiple Roblox windows can be opnened at once.',
						id: 'multi_roblox_btn',
						options: {
							type: 'button',
							style: 'default',
							icon: {
								component: Book,
							},
						},
					},
					{
						label: 'Open Instance',
						description: 'Opens an instance of the Roblox app. (Achieves the same goal as opening from the web)',
						id: 'open_instance_btn',
						options: {
							type: 'button',
							style: 'secondary',
							icon: {
								component: PictureInPicture,
							},
						},
					},
					{
						label: 'Terminate all instances',
						description: 'Closes every open Roblox instances. (This acts as a force-kill, so be sure to use this appropriately)',
						id: 'close_roblox_btn',
						options: {
							type: 'button',
							style: 'destructive',
							icon: {
								component: BugOff,
							},
						},
					},
				],
			},
			{
				name: 'Roblox Launching',
				description: 'Settings about launching Roblox',
				id: 'roblox_launching',
				interactables: [
					{
						label: 'Support launching from the website',
						description: 'Replaces roblox:// and roblox-player:// to open AppleBlox instead of Roblox.',
						id: 'use_roblox_url',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Create a launch shortcut',
						description: 'Creates a shortcut that can be used to launch Roblox (with all the AppleBlox features) without having to open this app.',
						id: 'create_shortcut_btn',
						options: {
							type: 'button',
							style: 'default',
							icon: {
								component: Play,
							},
						},
					},
					{
						label: 'Write ClientAppSettings.json',
						description: "Saves the FastFlags to Roblox directly for them to be used without using AppleBlox. This isn't recommended.",
						id: 'write_clientappsettings_btn',
						options: {
							type: 'button',
							style: 'outline',
							icon: {
								component: Braces,
							},
						},
					},
				],
			},
			{
				name: 'Other',
				description: "Features that don't really have a category.",
				id: 'advanced',
				interactables: [
					{
						label: "Enable sound for all notifications",
						description: "Will play a sound for every AppleBlox notification",
						id: "notify_all",
						options: {
							type: "boolean",
							state: false
						}
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
