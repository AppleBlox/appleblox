<script lang="ts">
	import { Github, MessageSquare } from 'lucide-svelte';
	import { os } from '@neutralinojs/lib';
	import Panel from '../components/settings/panel.svelte';
	import { SettingsPanelBuilder } from '../components/settings';

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

	const devlist = `
	<a href="https://github.com/OrigamingWasTaken">@OrigamingWasTaken</a> - Main Developper, currently the only one building AppleBlox.
	`;

	const artistlist = `
	<a href="_blank">@typeofnull</a> - Made the current app icon.<br>
	<a href="https://github.com/PurvisiLOL">@abyzal.</a> - Made the first version of the app icon.
	`;

	const testerlist = `
	<a href="_blank">@allFiction</a> - People who have tested the app, and repported bugs.
	`;

	const panel = new SettingsPanelBuilder()
		.setName('Info')
		.setDescription('Useful resources, people that helped making the app and technologies used')
		.setId('info')
		.addCategory((category) =>
			category
				.setName('Useful resources & support')
				.setDescription('Links and guides for AppleBlox')
				.setId('resources')
				.addButton({
					label: 'Join Discord server',
					description: 'Opens the Discord server invitation link',
					id: 'discord_btn',
					variant: 'default',
					icon: { component: MessageSquare },
				})
				.addButton({
					label: 'Github Repo',
					description: 'Opens the Github repository',
					id: 'github_btn',
					variant: 'secondary',
					icon: { component: Github },
				})
		)
		.addCategory((category) =>
			category
				.setName('Contributors')
				.setDescription('The ones who make AppleBlox')
				.setId('contributors')
				.addEmpty({ label: 'Developers', description: devlist, id: 'developers' })
				.addEmpty({ label: 'Artists', description: artistlist, id: 'artists' })
				.addEmpty({ label: 'Testers', description: testerlist, id: 'testers' })
		)
		.addCategory((category) =>
			category
				.setName('Technologies')
				.setDescription('Technologies used in AppleBlox')
				.setId('technologies')
				.addEmpty({ label: 'Icons8 - https://icons8.com', description: 'A lot of icons in the app', id: 'icons8' })
		)
		.addCategory((category) =>
			category
				.setName('Inspirations')
				.setDescription('People or projects that gave ideas for AppleBlox')
				.setId('inspirations')
				.addEmpty({
					label: 'Bloxstrap - https://github.com/pizzaboxer/bloxstrap',
					description:
						'A Roblox launcher for Windows. This was the main inspiration for this app. Made by <a href="https://github.com/pizzaboxer">@pizzaboxer</a>',
					id: 'bloxstrap',
				})
		)
		.build();
</script>

<Panel {panel} on:button={onButtonClicked} {render} />
