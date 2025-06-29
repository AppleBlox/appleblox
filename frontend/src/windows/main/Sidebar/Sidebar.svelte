<script lang="ts">
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { os, events } from '@neutralinojs/lib';
	import { createEventDispatcher } from 'svelte';
	import { version } from '../../../../../package.json';

	import EngineIcon from '@/assets/sidebar/engine.png';
	import IntegrationsIcon from '@/assets/sidebar/integrations.png';
	import KillIcon from '@/assets/sidebar/kill.png';
	import AppearanceIcon from '@/assets/sidebar/appearance.png';
	import ModsIcon from '@/assets/sidebar/mods.png';
	import PlayIcon from '@/assets/sidebar/play.png';
	import RobloxIcon from '@/assets/sidebar/roblox.png';
	import WorkshopIcon from '@/assets/sidebar/Workshop.png';

	import CreditsIcon from '@/assets/sidebar/info.png';
	import MiscIcon from '@/assets/sidebar/misc.png';

	import Button from '$lib/components/ui/button/button.svelte';
	import path from 'path-browserify';
	import shellFS from '../ts/tools/shellfs';
	import { getMode } from '../ts/utils';
	import SidebarBtn from './sidebar-btn.svelte';
	import ColorImage from '../components/color-image.svelte';

	export let isLaunched: boolean = false;
	export let currentPage = 'integrations';
	export let id: string;

	const sidebarBtns: { label: string; id: string; icon: string }[] = [
		{ label: 'Integrations', id: 'integrations', icon: IntegrationsIcon },
		{ label: 'Behavior', id: 'roblox', icon: RobloxIcon },
		{ label: 'Engine', id: 'engine', icon: EngineIcon },
		{ label: 'Mods', id: 'mods', icon: ModsIcon },
		{ label: 'Workshop', id: 'Workshop', icon: WorkshopIcon },
		{ label: 'Appearance', id: 'appearance', icon: AppearanceIcon },
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

	<div class="flex flex-col items-center mb-4 mt-auto">
		<p class="text-sm text-muted-foreground mb-2">v{version}</p>

		<div on:mouseenter={handleMouseEnter} on:mouseleave={handleMouseLeave} role="tooltip" class="w-full px-4">
			<Button
				class={`${isLaunched ? 'bg-primary/80 -hue-rotate-90 hover:bg-red-500 hover:hue-rotate-0' : 'bg-green-500/85 hover:bg-green-500/60'} font-mono w-full transition-all duration-200 group`}
				on:click={() => {
					if (isLaunched) {
						events.broadcast('instance:quit').catch(console.error);
						return;
					}
					dispatch('launchRoblox', true);
				}}
			>
				<ColorImage src={buttonIcon} alt="Button icon" class="w-5 h-5 mr-1 mt-[1px]" color="white" />
				<p class="font-mono transition duration-150">{buttonState}</p>
			</Button>
		</div>
	</div>
</div>
