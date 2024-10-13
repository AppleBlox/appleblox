<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { os } from '@neutralinojs/lib';
	import { BugOff, CopyCheck, PictureInPicture, Play } from 'lucide-svelte';
	import path from 'path-browserify';
	import { toast } from 'svelte-sonner';
	import LoadingSpinner from '../components/LoadingSpinner.svelte';
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import type { SettingsOutput } from '../components/settings/types';
	import Roblox from '../ts/roblox';

	export let render = true;

	let closeRobloxPopup = false;

	async function buttonClicked(e: CustomEvent) {
		const { id } = e.detail;
		switch (id) {
			case 'multi_roblox_btn':
				await Roblox.Utils.enableMultiInstance();
				break;
			case 'open_instance_btn':
				os.spawnProcess(`${path.join(Roblox.path, 'Contents/MacOS/RobloxPlayer')}; exit`);
				break;
			case 'close_roblox_btn':
				closeRobloxPopup = true;
				break;
			case 'create_shortcut_btn':
				try {
					await Roblox.Utils.createShortcut();
				} catch (err) {
					console.error('[RobloxPanel] ', err);
					toast.error('An error occured while trying to save the shortcut', {
						duration: 2000,
					});
					return;
				}
				break;
		}
	}

	async function switchClicked(e: CustomEvent) {
		const { id, state } = e.detail;
		switch (id) {
			case 'delegate':
				await Roblox.Delegate.toggle(state);
				break;
		}
	}

	const panel = new SettingsPanelBuilder()
		.setName('Roblox')
		.setDescription('Settings about the Roblox application')
		.setId('roblox')
		.addCategory((category) =>
			category
				.setName('Multi Instances')
				.setDescription('Run multiple Roblox windows at once')
				.setId('multi_instances')
				.addButton({
					label: 'Enable Multi Instances',
					description: 'Refresh the patch to make Roblox allow multiple windows',
					id: 'multi_roblox_btn',
					variant: 'default',
					icon: { component: CopyCheck },
				})
				.addButton({
					label: 'Open Instance',
					description: 'Open a Roblox instance (window)',
					id: 'open_instance_btn',
					variant: 'secondary',
					icon: { component: PictureInPicture },
				})
				.addButton({
					label: 'Terminate all instances',
					description: 'Force-close every open Roblox instances. (Make sure to have saved your progress)',
					id: 'close_roblox_btn',
					variant: 'destructive',
					icon: { component: BugOff },
				})
		)
		.addCategory((category) =>
			category
				.setName('Launching')
				.setDescription('Launching phase settings')
				.setId('launching')
				.addButton({
					label: 'Create a launch shortcut',
					description:
						'Creates a shortcut that can be used to launch Roblox (with all the AppleBlox features) without having to open this app',
					id: 'create_shortcut_btn',
					variant: 'default',
					icon: { component: Play },
				})
				.addSwitch({
					label: 'Delegate launching to AppleBlox',
					description:
						'When you launch Roblox, AppleBlox will open first in the background and apply the chosen settings',
					id: 'delegate',
					default: false,
				})
		)
		.build();

	let overrides: SettingsOutput = {};
	async function loadOverrides() {
		try {
			overrides = {
				launching: {
					delegate: await Roblox.Delegate.check(true),
				},
			};
		} catch (err) {
			console.warn("Couldn't load overrides:", err);
		}
	}
</script>

<AlertDialog.Root bind:open={closeRobloxPopup}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
			<AlertDialog.Description>All unsaved progress will be lost.</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				on:click={async () => {
					await Roblox.Utils.killAll();
					toast.success('All Roblox Instances have been closed.');
				}}>Continue</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

{#await loadOverrides()}
	{#if render}
		<LoadingSpinner />
	{/if}
{:then}
	<Panel {panel} on:switch={switchClicked} on:button={buttonClicked} {render} {overrides} />
{:catch error}
	{#if render}
		<h2 class="text-red-500">An error occured while loading settings overrides</h2>
		<p class="text-red-300">{error}</p>
	{/if}
{/await}
