<script lang="ts">
	import ApplebloxIcon from '@/assets/favicon.png';
	import GamebananaIcon from '@/assets/panel/gamebanana.png';
	import { filesystem, os } from '@neutralinojs/lib';
	import { Book } from 'lucide-svelte';
	import path from 'path-browserify';
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import shellFS from '../ts/tools/shellfs';
	import ModsUi from '../components/mods-ui.svelte';

	export let render = true;

	async function onButtonClicked(e: CustomEvent) {
		const { id } = e.detail;
		switch (id) {
			case 'open_gamebanana':
				os.open('https://gamebanana.com/games/2879');
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
		const { id, file } = e.detail;
		switch (id) {
			case 'custom_font': {
				const cachePath = path.join(await os.getEnv('HOME'), 'Library/Application Support/AppleBlox/cache/fonts');
				await shellFS.createDirectory(cachePath);
				await filesystem.copy(file, path.join(cachePath, `CustomFont${path.extname(file)}`)).catch(console.error);
				break;
			}
		}
	}

	async function onFileRemoved(e: CustomEvent) {
		const { id } = e.detail;
		switch (id) {
			case 'custom_font':
				for (const ext of ['ttf', 'otf', 'ttc']) {
					const fontPath = path.join(
						await os.getEnv('HOME'),
						'Library',
						'Application Support',
						`AppleBlox/cache/fonts/CustomFont.${ext}`
					);
					await shellFS.remove(
						path.join(
							await os.getEnv('HOME'),
							'Library',
							'Application Support',
							`AppleBlox/cache/fonts/LastCustomFont.${ext}`
						),
						{ skipStderrCheck: true }
					);
					if (await shellFS.exists(fontPath)) {
						await shellFS.move(
							fontPath,
							path.join(
								await os.getEnv('HOME'),
								'Library',
								'Application Support',
								`AppleBlox/cache/fonts/LastCustomFont.${ext}`
							)
						);
					}

					await shellFS.remove(fontPath, { skipStderrCheck: true });
				}
				break;
		}
	}

	const panel = new SettingsPanelBuilder()
		.setName('Mods')
		.setDescription('Custom textures and UI enhancements')
		.setId('mods')
		.addCategory((category) =>
			category
				.setName('Built-in')
				.setDescription('Default AppleBlox modifications')
				.setId('builtin')
				.addFilePicker({
					label: 'Custom Font',
					description: 'Choose a custom font file to apply to Roblox',
					id: 'custom_font',
					accept: ['ttf', 'otf', 'ttc'],
				})
		)
		.addCategory((category) =>
			category
				.setName('Custom Mods')
				.setDescription(
					"To install mods, drag files to the mods folder. Find mods in the AppleBlox discord server or Gamebanana."
				)
				.setId('general')
				.addButton({
					label: 'Installation Guide',
					description: 'Learn how to install mods (same process as Bloxstrap)',
					id: 'mods_help',
					variant: 'outline',
					icon: { component: Book },
				})
				.addButton({
					label: 'AppleBlox Discord',
					description: 'Join for AppleBlox support and updates',
					id: 'join_appleblox',
					variant: 'outline',
					icon: { src: ApplebloxIcon },
				})
				.addButton({
					label: 'Gamebanana',
					description: 'Find and download compatible mods',
					id: 'open_gamebanana',
					variant: 'outline',
					icon: { src: GamebananaIcon },
				})
				.addSwitch({
					label: 'Enable Mods',
					description: 'Apply installed mods to Roblox',
					id: 'enabled',
					default: false,
				})
				.addSwitch({
					label: 'Legacy Resolution',
					description: 'Lower resolution for mods not designed for Retina displays',
					id: 'fix_res',
					default: false,
				})
				.addCustom({ label: '', description: '', component: ModsUi, id: 'mods_ui' })
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

<Panel {panel} on:button={onButtonClicked} on:fileChosen={onFileAdded} on:fileRemoved={onFileRemoved} {render} />
