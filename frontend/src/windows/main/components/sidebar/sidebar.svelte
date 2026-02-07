<script lang="ts">
	import { os, events } from '@neutralinojs/lib';
	import { createEventDispatcher } from 'svelte';
	import { version } from '../../../../../../package.json';
	import Logger from '@/windows/main/ts/utils/logger';

	import EngineIcon from '@/assets/sidebar/engine.png';
	import IntegrationsIcon from '@/assets/sidebar/integrations.png';
	import KillIcon from '@/assets/sidebar/kill.png';
	import AppearanceIcon from '@/assets/sidebar/appearance.png';
	import ModsIcon from '@/assets/sidebar/mods.png';
	import PlayIcon from '@/assets/sidebar/play.png';
	import RobloxIcon from '@/assets/sidebar/roblox.png';
	import HomeIcon from '@/assets/sidebar/home.png';
	import AccountIcon from '@/assets/sidebar/account.png';

	import CreditsIcon from '@/assets/sidebar/info.png';
	import MiscIcon from '@/assets/sidebar/misc.png';

	import Button from '$lib/components/ui/button/button.svelte';
	import path from 'path-browserify';
	import shellFS from '../../ts/tools/shellfs';
	import { getMode } from '../../ts/utils';
	import SidebarBtn from './sidebar-btn.svelte';
	import ColorImage from '../color-image.svelte';
	import * as Card from '$lib/components/ui/card/index';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import Roblox from '../../ts/roblox';
	import RobloxDownloadDialog from '../roblox/roblox-download-dialog.svelte';
	import { RotateCcw } from 'lucide-svelte';
	import type { GameHistoryEntry } from '../../ts/activity/types';

	function getTooltipText(game: GameHistoryEntry): string {
		if (game.servers.length > 0) {
			const server = game.servers[0];
			const { city, country } = server.region;
			const location = city && country ? `${city}, ${country}` : country || 'Unknown';
			return `Rejoin ${game.name} in ${location}`;
		}
		return `Replay ${game.name}`;
	}

	export let isLaunched: boolean = false;
	export let currentPage = 'home';
	export let id: string;
	let showInstallDialog = false;
	let robloxInstalled = true; // Assume installed until checked
	let lastPlayedGame: GameHistoryEntry | null = null;

	// CMD + R to install Roblox
	events.on('installRoblox', () => {
		showInstallDialog = true;
	});

	// Check if Roblox is installed on mount and load last played game
	import { onMount } from 'svelte';
	onMount(async () => {
		robloxInstalled = await Roblox.Utils.hasRoblox();
		await loadLastPlayedGame();
	});

	// Refresh last played game when Roblox session ends
	let wasLaunched = false;
	$: {
		if (wasLaunched && !isLaunched) {
			// Session just ended, refresh history
			loadLastPlayedGame();
		}
		wasLaunched = isLaunched;
	}

	async function loadLastPlayedGame() {
		try {
			const { ActivityHistoryManager } = await import('../../ts/activity');
			const history = await ActivityHistoryManager.getHistory();
			lastPlayedGame = history.length > 0 ? history[0] : null;
		} catch {
			lastPlayedGame = null;
		}
	}

	const sidebarBtns: { label: string; id: string; icon: string }[] = [
		{ label: 'Quickplay', id: 'home', icon: HomeIcon },
		{ label: 'Account', id: 'account', icon: AccountIcon },
		{ label: 'Integrations', id: 'integrations', icon: IntegrationsIcon },
		{ label: 'Behavior', id: 'roblox', icon: RobloxIcon },
		{ label: 'Engine', id: 'engine', icon: EngineIcon },
		{ label: 'Mods', id: 'mods', icon: ModsIcon },
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
			Logger.debug('Running in "development" mode');
			if (!isDevBtnAdded) {
				sidebarBtns.push({ label: 'Dev', id: 'dev', icon: '' });
				isDevBtnAdded = true;
			}
		} else {
			Logger.debug('Running in "production" mode');
		}
	})();

	// Play button text and color
	let isHovering = false;
	$: buttonState = isLaunched ? (isHovering ? 'Kill' : 'Active') : robloxInstalled ? 'Play' : 'Install';
	$: buttonIcon =
		buttonState === 'Install'
			? RobloxIcon
			: buttonState === 'Play'
				? PlayIcon
				: buttonState === 'Active'
					? RobloxIcon
					: KillIcon;

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
	const dispatch = createEventDispatcher<{ launchRoblox: { url?: string } }>();

	async function handleRejoin() {
		if (!lastPlayedGame) return;
		let url: string;
		// If there's a server, rejoin that specific server
		if (lastPlayedGame.servers.length > 0) {
			const lastServer = lastPlayedGame.servers[0];
			url = `roblox://experiences/start?placeId=${lastPlayedGame.placeId}&gameInstanceId=${lastServer.jobId}`;
		} else {
			// Otherwise just launch the game
			url = `roblox://experiences/start?placeId=${lastPlayedGame.placeId}`;
		}
		dispatch('launchRoblox', { url });
	}
</script>

<Card.Root
	class="h-[96.5%] bg-card w-48 fixed top-0 left-0 overflow-x-hidden select-none flex flex-col my-3 ml-4 border-border/50 hover:bg-muted/30"
	{id}
>
	<div class="flex flex-col">
		<div class="flex flex-col justify-start items-start flex-grow w-full my-3">
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

		{#if lastPlayedGame && !isLaunched}
			<div class="w-full px-4 mb-2">
				<Tooltip.Root openDelay={0}>
					<Tooltip.Trigger asChild let:builder>
						<Button builders={[builder]} variant="outline" class="font-mono w-full text-sm" on:click={handleRejoin}>
							<RotateCcw class="w-4 h-4 mr-1.5" />
							<span class="truncate">{lastPlayedGame.servers.length > 0 ? 'Rejoin' : 'Replay'}</span>
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content side="right" class="flex items-center gap-2 max-w-xs">
						<img
							src={lastPlayedGame.iconUrl}
							alt={lastPlayedGame.name}
							class="w-6 h-6 rounded-full object-cover flex-shrink-0"
						/>
						<span class="text-sm">{getTooltipText(lastPlayedGame)}</span>
					</Tooltip.Content>
				</Tooltip.Root>
			</div>
		{/if}

		<div on:mouseenter={handleMouseEnter} on:mouseleave={handleMouseLeave} role="tooltip" class="w-full px-4">
			<Button
				class={`${
					isLaunched
						? 'bg-primary/80 -hue-rotate-90 hover:bg-red-500 hover:hue-rotate-0'
						: buttonState === 'Install'
							? 'bg-blue-500/85 hover:bg-blue-500/60'
							: 'bg-green-500/85 hover:bg-green-500/60'
				} font-mono w-full transition-all duration-200 group`}
				on:click={async () => {
					if (isLaunched) {
						events.broadcast('instance:quit').catch(Logger.error);
						return;
					}

					const isInstalled = await Roblox.Utils.hasRoblox();
					if (isInstalled) {
						dispatch('launchRoblox', {});
					} else {
						showInstallDialog = true;
					}
				}}
			>
				<ColorImage src={buttonIcon} alt="Button icon" class="w-5 h-5 mr-1 mt-[1px]" color="white" />
				<p class="font-mono transition duration-150">{buttonState}</p>
			</Button>
		</div>
	</div>
</Card.Root>

<RobloxDownloadDialog
	bind:open={showInstallDialog}
	on:downloadComplete={async () => {
		// Re-check Roblox installation status after download completes
		robloxInstalled = await Roblox.Utils.hasRoblox();
		showInstallDialog = false;
	}}
/>
