<script lang="ts">
	import { os, filesystem } from '@neutralinojs/lib';
	import path from 'path-browserify';
	import { toast } from 'svelte-sonner';
	import { sleep } from '../ts/utils';

	import ApplebloxIcon from "@/assets/favicon.png";
	import BloxstrapIcon from '@/assets/panel/bloxstrap.png';
	import { Book, Folder } from 'lucide-svelte';
	import shellFS from '../ts/shellfs';
	import Panel from '../components/settings/panel.svelte';
	import { SettingsPanelBuilder } from '../components/settings';
	import ModsUi from './Custom/ModsUI.svelte';

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
					toast.error(`An error occured: ${err}`);
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
			case 'custom_font': {
				const cachePath = path.join(await os.getEnv('HOME'), 'Library/Application Support/AppleBlox/.cache/fonts');
				await shellFS.createDirectory(cachePath);
				await filesystem.copy(filePath, path.join(cachePath, `CustomFont${path.extname(filePath)}`));
				break;
			}
		}
	}

	async function onFileRemoved(e: CustomEvent) {
		const { id } = e.detail;
		switch (id) {
			case 'custom_font':
				await os.execCommand('rm -f ~/"Library/Application Support/AppleBlox/.cache/fonts/CustomFont".*');
				break;
		}
	}

	const panel = new SettingsPanelBuilder()
		.setName('Mods')
		.setDescription('Textures and other enhancements')
		.setId('mods')
		.addCategory((category) =>
			category
				.setName('Built-in')
				.setDescription('Built-in mods and features')
				.setId('builtin')
				.addFilePicker({
					label: 'Custom Font',
					description: 'Choose a custom font to apply to Roblox',
					id: 'custom_font',
					accept: ['ttf', 'otf', 'ttc'],
				})
		)
		.addCategory((category) =>
			category
				.setName('General')
				.setDescription('Options about Roblox mods. To install mods, simply drag the files and folder you downloaded into AppleBlox\'s mods folder. To find mods, join the Bloxstrap Discord server. DO NOT ask help about AppleBlox there')
				.setId('general')
				.addButton({label: "Open mods folder", description: "Opens the mods folder in finder", id: "open_mods_folder", variant: "default", icon: {component: Folder}})
				.addButton({label: "Read mods guide", description: "Adding mods in AppleBlox is the same as Bloxstrap. You just have to put in the correct AppleBlox folders", id: "mods_help", variant: "outline", icon: {component: Book}})
				.addButton({label: "Join AppleBlox Discord server", description: "Opens the Discord server invitation link (go to the #mods channel)", id: "join_appleblox", variant: "outline", icon: {src: ApplebloxIcon}})
				.addButton({label: "Join Bloxstrap Discord server", description: "Opens the Discord server invitation link (go to the #mods channel)", id: "join_bloxstrap", variant: "outline", icon: {src: BloxstrapIcon}})
				.addSwitch({label: "Enable Mods", description: "Applies your mods", id: "enable_mods", default: false})
				.addSwitch({label: "Fix resolution", description: "Maximizes the resolution when opening Roblox. This fixes some icons not appearing in some cases", id: "spoof_res", default: false})
				.addCustom({label: "", description: "", component: ModsUi, id: "mods_ui"})


		)
		.build();

	const panelOpts = {
		name: 'Mods',
		description: 'Textures and other enhancement for the Roblox app',
		id: 'mods',
		sections: [
			{
				name: 'General',
				description:
					"Options about Roblox mods. To install mods, simply drag the files and folder you downloaded into AppleBlox's mods folder. To find mods, join the Bloxstrap Discord server. DO NOT ask help about AppleBlox there.",
				id: 'general',
				interactables: [
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

<Panel {panel} on:button={onButtonClicked} on:fileChosen={onFileAdded} on:fileRemoved={onFileRemoved} />
