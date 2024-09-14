<script lang="ts">
	import { Separator } from '$lib/components/ui/separator/index.js';
	import logo from '@/assets/favicon.png';
	import { os } from '@neutralinojs/lib';
	import { createEventDispatcher } from 'svelte';
	import { version } from '../../../../../package.json';

	import DiscordIcon from '@/assets/panel/discord.png';
	import GithubIcon from '@/assets/panel/github.png';
	import BugsIcon from '@/assets/sidebar/bugs.png';
	import FastFlagsIcon from '@/assets/sidebar/fastflags.png';
	import IntegrationsIcon from '@/assets/sidebar/integrations.png';
	import KillIcon from '@/assets/sidebar/kill.png';
	import ModsIcon from '@/assets/sidebar/mods.png';
	import PlayIcon from '@/assets/sidebar/play.png';
	import RobloxIcon from '@/assets/sidebar/roblox.png';

	import CreditsIcon from '@/assets/sidebar/credits.png';
	import MiscIcon from '@/assets/sidebar/misc.png';

	import Button from '$lib/components/ui/button/button.svelte';
	import path from 'path-browserify';
	import Roblox from '../ts/roblox';
	import { getMode, pathExists } from '../ts/utils';
	import LinkBtn from './LinkBtn.svelte';
	import SidebarBtn from './SidebarBtn.svelte';

	export const isLaunched: boolean = false;
	export let currentPage = 'integrations';
	export let id: string;

	// Sidebar Buttons
	const linksBtns: { label: string; icon: string; url: string }[] = [
		{ label: 'Discord', icon: DiscordIcon, url: 'https://appleblox.com/discord' },
		{
			label: 'GitHub',
			icon: GithubIcon,
			url: 'https://github.com/OrigamingWasTaken/appleblox',
		},
		{
			label: 'Issues',
			icon: BugsIcon,
			url: 'https://github.com/OrigamingWasTaken/appleblox/issues',
		},
	];

	const sidebarBtns: { label: string; id: string; icon: string }[] = [
		{ label: 'Integrations', id: 'integrations', icon: IntegrationsIcon },
		{ label: 'Roblox', id: 'roblox', icon: RobloxIcon },
		{ label: 'Fast Flags', id: 'fastflags', icon: FastFlagsIcon },
		{ label: 'Mods', id: 'mods', icon: ModsIcon },
		{ label: 'Misc', id: 'misc', icon: MiscIcon },
		{ label: 'Support', id: 'support', icon: CreditsIcon },
	];

	// App mode check (add 'Dev' sidebar button)
	let isDevBtnAdded = false;
	if (getMode() === 'dev' && !isDevBtnAdded) {
		sidebarBtns.push({ label: 'Dev', id: 'dev', icon: '' });
		isDevBtnAdded = true;
	}
	(async () => {
		if (await pathExists(path.join(await os.getEnv('HOME'), 'adevmode'))) {
			console.log('App is in developpement mode.');
			if (!isDevBtnAdded) {
				sidebarBtns.push({ label: 'Dev', id: 'dev', icon: '' });
				isDevBtnAdded = true;
			}
		} else {
			console.log('App is in production mode.');
		}
	})();

	// Play button text and color
	let isHovering = false;
	$: buttonState = isLaunched ? (isHovering ? 'Kill' : 'Active') : 'Play';
	$: buttonIcon =
		buttonState === 'Play' ? PlayIcon : buttonState === 'Active' ? RobloxIcon : KillIcon;

	function handleMouseEnter() {
		isHovering = true;
	}

	function handleMouseLeave() {
		isHovering = false;
	}

	// Change page on button click
	function sidebarItemClicked(e: CustomEvent) {
		if (e.detail === 'none') return;
		currentPage = e.detail;
	}

	// Launch roblox event
	const dispatch = createEventDispatcher<{ launchRoblox: boolean }>();
</script>

<div
	class="h-full bg-[#F3F4F6] dark:bg-[#1B1B1B] w-36 fixed top-0 left-0 overflow-x-hidden select-none flex flex-col"
	{id}
>
	<div class="flex-grow">
		<a
			href="https://github.com/OrigamingWasTaken/appleblox"
			class="flex justify-center"
			target="_blank"
			rel="noreferrer"
			on:click={() => {
				os.open('https://github.com/OrigamingWasTaken/appleblox').catch(console.error);
			}}
		>
			<div class="mt-3 flex">
				<img src={logo} class="h-12 mr-1 opacity-85 logo rounded-lg" alt="Svelte Logo" />
				<!-- <p class="text-black dark:text-white font-bold font-mono logo">AppleBlox</p> -->
			</div>
		</a>
		<div class="m-4">
			<Separator class="my-4 bg-gray-500" />
		</div>
		<div class="mt-3 grid grid-cols-1">
			{#each sidebarBtns as { label, id, icon }}
				<SidebarBtn
					bind:currentPage
					{label}
					{id}
					{icon}
					on:sidebarClick={sidebarItemClicked}
				/>
			{/each}
		</div>
		<div class="m-4">
			<Separator class="my-1 bg-gray-500" />
		</div>
		<div class="mt-3 grid grid-cols-1">
			{#each linksBtns as { label, url, icon }}
				<LinkBtn {label} {url} {icon} />
			{/each}
		</div>
	</div>
	<div class="flex flex-col items-center mb-4">
		<p class="text-sm text-gray-500 mb-2">v{version}</p>

		<div
			on:mouseenter={handleMouseEnter}
			on:mouseleave={handleMouseLeave}
			role="tooltip"
			class="w-[105px]"
		>
			<Button
				class={`${isLaunched ? 'bg-blue-400 hover:bg-red-500' : 'bg-green-600 hover:bg-green-800'} font-mono w-full`}
				on:click={() => {
					if (isLaunched) {
						Roblox.Utils.killAll();
						return;
					}
					dispatch('launchRoblox', true);
				}}
			>
				<img
					src={buttonIcon}
					alt="Button Icon"
					class="mr-1 mt-[1px] w-5 h-5 towhite-always"
				/>
				<p class="font-mono transition duration-150">{buttonState}</p>
			</Button>
		</div>
	</div>
</div>

<style>
	.logo {
		filter: drop-shadow(0 0 2em #ff6464aa);
	}
</style>
