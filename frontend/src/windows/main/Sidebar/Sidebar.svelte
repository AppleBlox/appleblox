<script lang="ts">
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { os } from '@neutralinojs/lib';
	import { createEventDispatcher } from 'svelte';
	import { version } from '../../../../../package.json';

	import BugsIcon from '@/assets/sidebar/bugs.png';
	import DiscordIcon from '@/assets/sidebar/discord.png';
	import FastFlagsIcon from '@/assets/sidebar/fastflags.png';
	import GithubIcon from '@/assets/sidebar/github.png';
	import IntegrationsIcon from '@/assets/sidebar/integrations.png';
	import KillIcon from '@/assets/sidebar/kill.png';
	import ModsIcon from '@/assets/sidebar/mods.png';
	import PlayIcon from '@/assets/sidebar/play.png';
	import RobloxIcon from '@/assets/sidebar/roblox.png';

	import CreditsIcon from '@/assets/sidebar/info.png';
	import MiscIcon from '@/assets/sidebar/misc.png';

	import Button from '$lib/components/ui/button/button.svelte';
	import path from 'path-browserify';
	import Roblox from '../ts/roblox';
	import shellFS from '../ts/tools/shellfs';
	import { getMode } from '../ts/utils';
	import LinkBtn from './LinkBtn.svelte';
	import SidebarBtn from './SidebarBtn.svelte';

	export let isLaunched: boolean = false;
	export let currentPage = 'integrations';
	export let id: string;

	// Sidebar Buttons
	const linksBtns: { label: string; icon: string; url: string }[] = [
		{ label: 'Discord', icon: DiscordIcon, url: 'https://appleblox.com/discord' },
		{
			label: 'GitHub',
			icon: GithubIcon,
			url: 'https://github.com/AppleBlox/appleblox',
		},
		{
			label: 'Issues',
			icon: BugsIcon,
			url: 'https://github.com/AppleBlox/appleblox/issues',
		},
	];

	const sidebarBtns: { label: string; id: string; icon: string }[] = [
		{ label: 'Integrations', id: 'integrations', icon: IntegrationsIcon },
		{ label: 'Roblox', id: 'roblox', icon: RobloxIcon },
		{ label: 'FastFlags', id: 'fastflags', icon: FastFlagsIcon },
		{ label: 'Mods', id: 'mods', icon: ModsIcon },
		{ label: 'Misc', id: 'misc', icon: MiscIcon },
		{ label: 'Info', id: 'info', icon: CreditsIcon },
	];

	// App mode check (add 'Dev' sidebar button)
	let isDevBtnAdded = false;
	if (getMode() === 'dev' && !isDevBtnAdded) {
		sidebarBtns.push({ label: 'Dev', id: 'dev', icon: '' });
		isDevBtnAdded = true;
	}
	(async () => {
		if (await shellFS.exists(path.join(await os.getEnv('HOME'), 'adevmode'))) {
			console.debug('[App] Running in "development" mode');
			if (!isDevBtnAdded) {
				sidebarBtns.push({ label: 'Dev', id: 'dev', icon: '' });
				isDevBtnAdded = true;
			}
		} else {
			console.debug('[App] Running in "production" mode');
		}
	})();

	// Play button text and color
	let isHovering = false;
	$: buttonState = isLaunched ? (isHovering ? 'Kill' : 'Active') : 'Play';
	$: buttonIcon = buttonState === 'Play' ? PlayIcon : buttonState === 'Active' ? RobloxIcon : KillIcon;

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

<div class="h-full bg-card w-48 fixed top-0 left-0 overflow-x-hidden select-none flex flex-col" {id}>
	<div class="flex flex-col">
		<a
			href="https://github.com/AppleBlox/appleblox"
			class="flex items-center justify-center mt-3"
			target="_blank"
			rel="noreferrer"
			on:click={() => {
				os.open('https://github.com/AppleBlox/appleblox').catch((err) => {
					console.error('[UI.Sidebar] ', err);
				});
			}}
		>
			<p class="text-primary font-bold font-mono text-2xl">AppleBlox</p>
		</a>
		<div class="my-3 mx-3">
			<Separator />
		</div>
		<div class="flex flex-col justify-start items-start flex-grow w-full">
			{#each sidebarBtns as { label, id, icon }, index}
				<SidebarBtn
					position={{ total: sidebarBtns.length, index }}
					bind:currentPage
					{label}
					{id}
					{icon}
					on:sidebarClick={sidebarItemClicked}
				/>
			{/each}
		</div>
	</div>

	<div class="mt-auto flex flex-col items-center px-10 mb-4">
		{#each linksBtns as { label, url, icon }}
			<LinkBtn {label} {url} {icon} />
		{/each}
	</div>
	<div class="flex flex-col items-center mb-4">
		<p class="text-sm text-muted-foreground mb-2">v{version}</p>

		<div on:mouseenter={handleMouseEnter} on:mouseleave={handleMouseLeave} role="tooltip" class="w-full px-4">
			<Button
				class={`${isLaunched ? 'bg-primary/80 -hue-rotate-90 hover:bg-kill-red hover:hue-rotate-0' : 'bg-play-green/85 hover:bg-play-green/60'} font-mono w-full transition-all duration-200 group`}
				on:click={() => {
					if (isLaunched) {
						Roblox.Utils.killAll();
						return;
					}
					dispatch('launchRoblox', true);
				}}
			>
				<img src={buttonIcon} alt="Button Icon" class="mr-1 mt-[1px] w-5 h-5 towhite-always" />
				<p class="font-mono transition duration-150">{buttonState}</p>
			</Button>
		</div>
	</div>
</div>
