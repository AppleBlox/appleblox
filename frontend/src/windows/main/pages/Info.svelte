<script lang="ts">
	import { os } from '@neutralinojs/lib';
	import { Github, MessageSquare } from 'lucide-svelte';
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import Informations from '../components/informations/informations.svelte';

	export let render = true;

	function onButtonClicked(e: CustomEvent) {
		const { id } = e.detail;
		switch (id) {
			case 'discord_btn':
				os.open('https://appleblox.com/discord');
				break;
			case 'github_btn':
				os.open('https://github.com/AppleBlox/appleblox');
				break;
		}
	}

	const panel = new SettingsPanelBuilder()
		.setName('About')
		.setId('info')
		.setDescription('About AppleBlox and helpful resources')
		.addCategory((category) =>
			category.setId('contributors').addCustom({
				label: '',
				description: '',
				id: 'info_page',
				component: Informations,
			})
		)
		.addCategory((category) =>
			category
				.setName('Links')
				.setDescription('Community and development resources')
				.setId('resources')
				.addButton({
					label: 'Discord Server',
					description: 'Get help and connect with the community',
					id: 'discord_btn',
					variant: 'outline',
					icon: { component: MessageSquare },
				})
				.addButton({
					label: 'Github',
					description: 'View source code, report issues and contribute',
					id: 'github_btn',
					variant: 'outline',
					icon: { component: Github },
				})
		)
		.build();
</script>

<Panel {panel} on:button={onButtonClicked} {render} />
