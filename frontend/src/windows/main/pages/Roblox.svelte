<script lang="ts">
	import type { SettingsPanel } from '@/types/settings';
	import { saveSettings } from '../ts/settings';
	import Panel from './Settings/Panel.svelte';
	import { Book, Braces, BugOff, PictureInPicture, Play } from 'lucide-svelte';
	import { filesystem, os } from '@neutralinojs/lib';
	import path from 'path-browserify';
	import { getRobloxPath } from '../ts/roblox/path';
	import Roblox from '../ts/roblox';
	import { toast } from 'svelte-sonner';
	import { pathExists } from '../ts/utils';

	function settingsChanged(o: { [key: string]: any }) {
		saveSettings('roblox', o);
	}

	async function buttonClicked(e: CustomEvent) {
		const id = e.detail;
		switch (id) {
			case 'multi_roblox_btn':
				await Roblox.Utils.enableMultiInstance();
				break;
			case 'open_instance_btn':
				os.spawnProcess(
					`${path.join(getRobloxPath(), 'Contents/MacOS/RobloxPlayer')}; exit`
				);
				break;
			case 'close_roblox_btn':
				await Roblox.Utils.killAll();
				toast.success('All Roblox Instances have been closed.');
				break;
			case 'create_shortcut_btn':
				try {
					await Roblox.Utils.createShortcut();
				} catch (err) {
					console.error(err);
					toast.error('An error occured while trying to save the shortcut', {
						duration: 2000,
					});
					return;
				}
				break;
			case 'write_clientappsettings_btn':
				try {
					const filePath = path.join(
						getRobloxPath(),
						'Contents/MacOS/ClientSettings/AppClientSettings.json'
					);
					if (await pathExists(filePath)) {
						await filesystem.remove(filePath);
					}
					await filesystem.createDirectory(path.dirname(filePath));
					const fflags = {
						...(await Roblox.FFlags.parseFlags(false)),
						...(await Roblox.FFlags.parseFlags(true)),
					};
					await filesystem.writeFile(filePath, JSON.stringify(fflags));
					toast.success(`Wrote ClientAppSettings at "${filePath}"`);
				} catch (err) {
					console.error(err);
					toast.error('An error occured while writing ClientAppSettings.json');
				}
				break;
		}
	}

	async function switchClicked(e: CustomEvent) {
		const { id, state } = e.detail;
		switch (id) {
			case 'redirect_appleblox':
				Roblox.Utils.toggleURI(state).catch((err) => {
					toast.error('An error occured');
					console.error(err);
				});
		}
	}

	const panelOpts: SettingsPanel = {
		name: 'Roblox',
		description: 'Settings about the Roblox application',
		id: 'roblox',
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
						description:
							'Opens an instance of the Roblox app. (Achieves the same goal as opening from the web)',
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
						description:
							'Closes every open Roblox instances. (This acts as a force-kill, so be sure to use this appropriately)',
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
						label: 'Redirect Roblox to AppleBlox',
						description:
							'AppleBlox will be opened first when playing Roblox. (Supports launching from the Website, and the Roblox app directly)',
						id: 'redirect_appleblox',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Create a launch shortcut',
						description:
							'Creates a shortcut that can be used to launch Roblox (with all the AppleBlox features) without having to open this app.',
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
						description:
							"Saves the FastFlags to Roblox directly for them to be used without using AppleBlox. This isn't recommended.",
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
		],
	};

	const robloxLaunchingIndex = panelOpts.sections?.findIndex(
		(panel) => panel.id === 'roblox_launching'
	);
	if (robloxLaunchingIndex) {
		const redirectApplebloxIndex = panelOpts.sections[
			robloxLaunchingIndex
		].interactables?.findIndex((i) => i.id === 'redirect_appleblox');
		if (redirectApplebloxIndex) {
			pathExists(path.join(getRobloxPath(), 'Contents/MacOS/RobloxPlayer.bak')).then(
				(exists) => {
					if (exists) {
						// @ts-expect-error: This interactable is boolean
						panelOpts.sections[robloxLaunchingIndex].interactables[
							redirectApplebloxIndex
						].options.value = true;
					}
				}
			);
		}
	}
</script>

<Panel
	panel={panelOpts}
	on:settingsChanged={(e) => {
		settingsChanged(e.detail);
	}}
	on:buttonClicked={buttonClicked}
	on:switchClicked={switchClicked}
/>
