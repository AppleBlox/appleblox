<script lang="ts">
	import DiscordIcon from '@/assets/panel/discord.png';
	import GithubIcon from '@/assets/panel/github.png';
	import type { SettingsPanel } from '@/types/settings';
	import { os } from '@neutralinojs/lib';
	import Panel from './Settings/Panel.svelte';

	function onButtonClicked(id: string) {
		switch (id) {
			case 'discord_btn':
				os.open('https://appleblox.com/discord');
				break;
			case 'github_btn':
				os.open('https://github.com/OrigamingWasTaken/appleblox');
				break;
		}
	}

	const devlist = `
	<a href="https://github.com/OrigamingWasTaken">@OrigamingWasTaken</a> - Main Developper, currently the only one building AppleBlox.
	`;
	const testerlist = `
	<a href="_blank">@KeyboardChampion, @YousufSSyed, @angrysausage</a> - People who have tested the app, and repported bugs.
	`;

	const panelOpts: SettingsPanel = {
		name: 'Support',
		description: 'Useful resources, people that helped making the app and technologies used',
		id: 'support',
		sections: [
			{
				name: 'Useful resources & support',
				description: 'Links and guides for AppleBlox',
				id: 'resources',
				interactables: [
					{
						label: 'Join Discord server',
						description: 'appleblox.com/discord',
						id: 'discord_btn',
						options: {
							type: 'button',
							icon: {
								src: DiscordIcon,
							},
							style: 'default',
						},
					},
					{
						label: 'GitHub Repo',
						description: 'Takes you to the github repo',
						id: 'github_btn',
						options: {
							type: 'button',
							icon: {
								src: GithubIcon,
							},
							style: 'secondary',
						},
					},
				],
			},
			{
				name: 'Contributors',
				description: 'The ones who make AppleBlox',
				id: 'contributors',
				interactables: [
					{
						label: 'Developpers',
						description: devlist,
						id: 'devs_list',
						options: {
							type: 'none',
						},
					},
					{
						label: 'Testers',
						description: testerlist,
						id: 'testers',
						options: {
							type: 'none',
						},
					},
				],
			},
			{
				name: 'Technologies',
				description: 'Technologies used',
				id: 'technologies',
				interactables: [
					{
						label: 'NeutralinoJS - https://neutralino.js.org',
						description:
							'The framework used to access the filesystem, etc... and package html,js and css as an app.',
						id: 'neutralino',
						options: {
							type: 'none',
						},
					},
					{
						label: 'Svelte - https://svelte.dev',
						description: 'Framework used for the UI and frontend.',
						id: 'svelte',
						options: {
							type: 'none',
						},
					},
					{
						label: 'Icons - https://icons8.com',
						description: 'All the icons used in the app.',
						id: 'icons',
						options: {
							type: 'none',
						},
					},
				],
			},
			{
				name: 'Inspirations',
				description: 'People or projects that gave ideas for AppleBlox',
				id: 'inspirations',
				interactables: [
					{
						label: 'Bloxstrap - https://github.com/pizzaboxer/bloxstrap',
						description:
							'A Roblox launcher for Windows. This was the main inspiration for this app. Made by <a href="https://github.com/pizzaboxer">@pizzaboxer</a>',
						id: 'devs_list',
						options: {
							type: 'none',
						},
					},
				],
			},
		],
	};
</script>

<Panel
	panel={panelOpts}
	on:buttonClicked={(e) => {
		onButtonClicked(e.detail);
	}}
/>
