<script lang="ts">
	import type { SettingsPanel } from "@/types/settings";
	import Panel from "./Settings/Panel.svelte";

	const devlist = `
	<a href="https://github.com/OrigamingWasTaken">@OrigamingWasTaken</a> - Main Developper, currently the only one building AppleBlox.
	`
	const testerlist = `
	<a href="_blank">@KeyboardChampion, @YousufSSyed</a> - People who have tested the app, and repported bugs.
	`

	const panelOpts: SettingsPanel = {
		name: "Credits",
		description: "People that helped making the app and technologies used",
		id: "credits",
		sections: [
			{
				name: "Contributors",
				description: "The ones who make AppleBlox",
				id: "contributors",
				interactables: [
					{
						label: "Developpers",
						description: devlist,
						id: "devs_list",
						options: {
							type: "none"
						},
					},
					{
						label: "Testers",
						description: testerlist,
						id: "devs_list",
						options: {
							type: "none"
						},
					}
				],
			},
			{
				name: "Technologies",
				description: "Technologies used",
				id: "technologies",
				interactables: [
					{
						label: "NeutralinoJS - https://neutralino.js.org",
						description: "The framework used to access the filesystem, etc... and package html,js and css as an app.",
						id: "devs_list",
						options: {
							type: "none"
						},
					},
					{
						label: "Svelte - https://svelte.dev",
						description: "Framework used for the UI and frontend.",
						id: "devs_list",
						options: {
							type: "none"
						},
					},
					{
						label: "Icons - https://icons8.com",
						description: "All the icons used in the app.",
						id: "devs_list",
						options: {
							type: "none"
						},
					}
				],
			},
			{
				name: "Inspirations",
				description: "People or projects that gave ideas for AppleBlox",
				id: "inspirations",
				interactables: [
					{
						label: "Bloxstrap - https://github.com/pizzaboxer/bloxstrap",
						description: 'A Roblox launcher for Windows. This was the main inspiration for this app. Made by <a href="https://github.com/pizzaboxer">@pizzaboxer</a>',
						id: "devs_list",
						options: {
							type: "none"
						},
					}
				],
			}
		],
	};
</script>

<Panel panel={panelOpts} />
