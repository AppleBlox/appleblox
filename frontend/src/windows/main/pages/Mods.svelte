<script lang="ts">
	import type { SettingsPanel } from '@/types/settings';
	import Panel from './Settings/Panel.svelte';
	import { filesystem, os } from '@neutralinojs/lib';
	import path from 'path-browserify';
	import { sleep } from '../ts/utils';
	import { toast } from 'svelte-sonner';
	import { saveSettings } from '../ts/settings';

	import ApplebloxIcon from '@/assets/panel/appleblox.png';
	import BloxstrapIcon from '@/assets/panel/bloxstrap.png';
	import { Folder, Book } from 'lucide-svelte';
	import shellFS from '../ts/shellfs';

	function settingsChanged(o: { [key: string]: any }) {
		saveSettings('mods', o);
	}

	async function onButtonClicked(e: CustomEvent) {
		const buttonId = e.detail;
		switch (buttonId) {
			case 'open_mods_folder':
				try {
					const folderPath = path.join(await os.getEnv('HOME'), 'Library', 'Application Support', 'AppleBlox/mods');
					await os.execCommand(`mkdir -p "${folderPath}"`);
					await sleep(10);
					await os.execCommand(`open "${folderPath}"`);
				} catch (err) {
					toast.error('An error occured: ' + err);
					console.error(err);
				}
				break;
			case 'join_bloxstrap':
				os.open('https://discord.gg/nKjV3mGq6R');
				break;
			case 'join_appleblox':
				os.open('https://appleblox.com/discord');
				break;
			case 'mods_help':
				os.open('https://github.com/pizzaboxer/bloxstrap/wiki/Adding-custom-mods');
				break;
		}
	}

	async function onFileAdded(e: CustomEvent) {
		const { id, filePath } = e.detail;
		switch (id) {
			case 'custom_font':
				const cachePath = path.join(await os.getEnv('HOME'), 'Library/Application Support/AppleBlox/.cache/fonts');
				await shellFS.createDirectory(cachePath);
				await filesystem.copy(filePath, path.join(cachePath, `CustomFont${path.extname(filePath)}`));
				break;
		}
	}

	async function onFileRemoved(e: CustomEvent) {
		const { id, filePath } = e.detail;
		switch (id) {
			case 'custom_font':
				await os.execCommand('rm -f ~/"Library/Application Support/AppleBlox/.cache/fonts/CustomFont".*');
				break;
		}
	}

	const panelOpts: SettingsPanel = {
		name: 'Mods',
		description: 'Textures and other enhancement for the Roblox app',
		id: 'mods',
		sections: [
			{
				name: 'Built-in',
				description: 'Built-in mods and features you can directly use',
				id: 'builtin',
				interactables: [
					{
						label: 'Custom font',
						description: 'Choose a custom font to apply to Roblox',
						id: 'custom_font',
						options: {
							type: 'file',
							accept: ['ttf', 'otf', 'ttc'],
						},
					},
				],
			},
			{
				name: 'General',
				description:
					"Options about Roblox mods. To install mods, simply drag the files and folder you downloaded into AppleBlox's mods folder. To find mods, join the Bloxstrap Discord server. DO NOT ask help about AppleBlox there.",
				id: 'general',
				interactables: [
					{
						label: 'Open Mods folder',
						description: 'Opens the Mods folder in Finder',
						id: 'open_mods_folder',
						options: {
							type: 'button',
							style: 'default',
							icon: {
								component: Folder,
							},
						},
					},
					{
						label: 'Read the Mods Guide',
						description: 'Adding mods in AppleBlox is the same as Bloxstrap. You just have to put in the correct AppleBlox folders.',
						id: 'mods_help',
						options: {
							type: 'button',
							style: 'secondary',
							icon: {
								component: Book,
							},
						},
					},
					{
						label: 'Join AppleBlox Discord server',
						description: 'Opens the Discord server invitation link (go to the #mods channel)',
						id: 'join_appleblox',
						options: {
							type: 'button',
							style: 'outline',
							icon: {
								src: ApplebloxIcon,
							},
						},
					},
					{
						label: 'Join Bloxstrap Discord server',
						description: 'Opens the Discord server invitation link (go to the #mods channel)',
						id: 'join_bloxstrap',
						options: {
							type: 'button',
							style: 'outline',
							icon: {
								src: BloxstrapIcon,
							},
						},
					},
					{
						label: 'Enable Mods',
						description: 'Enable/Disable your mods',
						id: 'enable_mods',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Fix Resolution',
						description: 'Maximizes the resolution when opening Roblox. This fixes some icons not showing in some cases.',
						id: 'spoof_res',
						options: {
							type: 'boolean',
							state: false,
						},
					},
					{
						label: 'Manage Mods',
						description: 'internal',
						id: 'mods_ui_space',
						hideTitle: true,
						options: {
							type: 'mods_ui',
						},
					},
				],
			},
		],
	};
</script>

<Panel
	panel={panelOpts}
	on:buttonClicked={onButtonClicked}
	on:fileAdded={onFileAdded}
	on:fileRemoved={onFileRemoved}
	on:settingsChanged={(e) => {
		settingsChanged(e.detail);
	}}
/>
