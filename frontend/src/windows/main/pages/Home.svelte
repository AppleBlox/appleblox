<script lang="ts">
	import { onMount } from 'svelte';
	import { events, os } from '@neutralinojs/lib';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card/index';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import { ActivityHistoryManager, type GameHistoryEntry } from '../ts/activity';
	import { hasRobloxCookie } from '../ts/roblox/accounts';
	import { getRecentGames } from '../ts/roblox/api';
	import { getCachedRecentGames, setCachedRecentGames } from '../ts/roblox/games-cache';
	import ServerListDialog from '../components/activity/server-list-dialog.svelte';
	import Logger from '@/windows/main/ts/utils/logger';
	import {
		Play,
		Globe,
		Gamepad2,
		ExternalLink,
		Server,
		RefreshCw,
		Trash2,
		Lightbulb,
	} from 'lucide-svelte';
	import { fade } from 'svelte/transition';

	export let render = true;

	interface DisplayGame extends GameHistoryEntry {
		source: 'tracked' | 'roblox';
	}

	let combinedGames: DisplayGame[] = [];
	let isLoading = true;
	let isRefreshing = false;
	let hasAccount = false;
	let showClearDialog = false;
	let serverDialogOpen = false;
	let selectedGame: GameHistoryEntry | null = null;

	onMount(async () => {
		if (!render) return;
		await loadInstant();
		refreshFromApi();
	});

	/** Phase 1: Instant load from local history + cache */
	async function loadInstant() {
		isLoading = true;
		try {
			hasAccount = await hasRobloxCookie();

			const [localHistory, cachedGames] = await Promise.all([
				ActivityHistoryManager.getHistory(),
				hasAccount ? getCachedRecentGames() : Promise.resolve(null),
			]);

			combinedGames = mergeGames(localHistory, cachedGames || []);
		} catch (err) {
			Logger.error('Failed to load quickplay data:', err);
		}
		isLoading = false;
	}

	/** Phase 2: Background refresh from API */
	async function refreshFromApi() {
		if (!hasAccount) return;
		isRefreshing = true;
		try {
			const [localHistory, apiGames] = await Promise.all([
				ActivityHistoryManager.getHistory(),
				getRecentGames(20),
			]);

			combinedGames = mergeGames(localHistory, apiGames);

			// Persist to cache for next instant load
			await setCachedRecentGames(apiGames);
		} catch (err) {
			Logger.warn('Background refresh failed:', err);
		}
		isRefreshing = false;
	}

	/** Merge local tracked games with API/cached games */
	function mergeGames(
		localHistory: GameHistoryEntry[],
		apiGames: Array<{ placeId: string; universeId: string; name: string; creator: string; iconUrl: string; lastPlayed: number }>
	): DisplayGame[] {
		const localPlaceIds = new Set(localHistory.map((g) => g.placeId));
		const localDisplayGames: DisplayGame[] = localHistory.map((g) => ({ ...g, source: 'tracked' }));

		const apiDisplayGames: DisplayGame[] = apiGames
			.filter((g) => !localPlaceIds.has(g.placeId))
			.map((g) => ({
				...g,
				servers: [],
				source: 'roblox' as const,
			}));

		return [...localDisplayGames, ...apiDisplayGames];
	}

	async function clearHistory() {
		showClearDialog = false;
		try {
			await ActivityHistoryManager.clearHistory();
			await loadInstant();
		} catch (error) {
			Logger.error('Failed to clear activity history:', error);
		}
	}

	function formatTimeAgo(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return new Date(timestamp).toLocaleDateString();
	}

	function launchGame(placeId: string) {
		events.broadcast('history:launchGame', { url: `roblox://experiences/start?placeId=${placeId}` });
	}

	async function openGamePage(placeId: string) {
		try {
			await os.open(`https://www.roblox.com/games/${placeId}/`);
		} catch (error) {
			Logger.error('Failed to open game page:', error);
		}
	}

	function handleViewServers(game: GameHistoryEntry) {
		selectedGame = game;
		serverDialogOpen = true;
	}

	function goToAccount() {
		events.broadcast('ui:change_page', { id: 'account' });
	}

	function handleMouseMove(event: MouseEvent) {
		const card = (event.currentTarget as HTMLElement).closest('.game-card') as HTMLElement;
		if (!card) return;
		const rect = card.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;
		const rotateX = ((y - centerY) / centerY) * -8;
		const rotateY = ((x - centerX) / centerX) * 8;
		card.style.setProperty('--rotate-x', `${rotateX}deg`);
		card.style.setProperty('--rotate-y', `${rotateY}deg`);
	}

	function handleMouseLeave(event: MouseEvent) {
		const card = (event.currentTarget as HTMLElement).closest('.game-card') as HTMLElement;
		if (!card) return;
		card.style.setProperty('--rotate-x', '0deg');
		card.style.setProperty('--rotate-y', '0deg');
	}
</script>

{#if render}
	{#if isLoading}
		<div class="flex h-[100vh] w-full items-center justify-center">
			<div class="w-6 h-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
		</div>
	{:else}
		<div transition:fade={{ duration: 200 }}>
			<!-- Title Card -->
			<Card.Root class="font-mono grid grid-cols-1 h-full text-start ml-8 my-3 p-5 w-[95%] border-border/50">
				<p class="text-3xl font-bold text-black dark:text-white">Quickplay</p>
				<p class="text-[13px] text-neutral-700 dark:text-neutral-300">
					Your recent games at a glance
				</p>
			</Card.Root>

			<!-- Tip Banner (when not logged in) -->
			{#if !hasAccount}
				<Card.Root class="font-mono ml-8 my-2 w-[95%] border-primary/20 bg-primary/5">
					<div class="flex items-center gap-3 p-4">
						<Lightbulb class="w-5 h-5 text-primary flex-shrink-0" />
						<p class="text-sm text-muted-foreground flex-1">
							<span class="font-medium text-foreground">Tip:</span> Connect your Roblox account to see all your recent games, not just the ones played through AppleBlox.
						</p>
						<Button variant="outline" size="sm" on:click={goToAccount}>Connect</Button>
					</div>
				</Card.Root>
			{/if}

			<!-- Games Section -->
			<Card.Root class="font-mono grid grid-cols-1 h-full text-start ml-8 my-4 p-5 w-[95%] border-border/50">
				<div>
					<div class="flex items-center justify-between mb-4">
						<div>
							<p class="text-xl font-bold text-primary">Recent Games</p>
							<p class="text-[13px] text-primary saturate-[20%] brightness-200 font-semibold">
								Locally tracked and Roblox recent games
							</p>
						</div>
						<div class="flex items-center gap-2">
							<Button variant="outline" size="sm" on:click={refreshFromApi} disabled={isRefreshing}>
								<RefreshCw class="w-4 h-4 mr-1.5 {isRefreshing ? 'animate-spin' : ''}" />
								Refresh
							</Button>
							{#if combinedGames.some((g) => g.source === 'tracked')}
								<Button variant="destructive" size="sm" on:click={() => (showClearDialog = true)}>
									<Trash2 class="w-4 h-4 mr-1.5" />
									Clear
								</Button>
							{/if}
						</div>
					</div>

					{#if combinedGames.length === 0}
						<div class="py-12 text-center border border-dashed border-border/50 rounded-lg">
							<Gamepad2 class="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
							<p class="text-muted-foreground">No recent games</p>
							<p class="text-sm text-muted-foreground/70">Play some games to see them here</p>
						</div>
					{:else}
						<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
							{#each combinedGames as game (game.placeId)}
								<div class="game-card">
									<DropdownMenu.Root>
										<DropdownMenu.Trigger class="w-full text-left focus:outline-none">
											<div
												class="cursor-pointer"
												on:mousemove={handleMouseMove}
												on:mouseleave={handleMouseLeave}
												on:contextmenu|preventDefault
												role="button"
												tabindex="0"
											>
												<div
													class="h-full overflow-hidden rounded-lg transition-shadow hover:shadow-lg border border-border/50"
												>
													<div class="aspect-square w-full overflow-hidden bg-muted relative">
														<img
															src={game.iconUrl}
															alt={game.name}
															class="w-full h-full object-cover"
														/>
														<!-- Source badge -->
														<div class="absolute top-2 left-2">
															{#if game.source === 'tracked'}
																<Badge
																	variant="default"
																	class="text-[10px] font-medium bg-green-600/90 hover:bg-green-600/90 text-white"
																>
																	Tracked
																</Badge>
															{:else}
																<Badge
																	variant="default"
																	class="text-[10px] font-medium bg-blue-600/90 hover:bg-blue-600/90 text-white"
																>
																	Roblox
																</Badge>
															{/if}
														</div>
														<!-- Server count badge -->
														{#if game.servers && game.servers.length > 0}
															<div class="absolute top-2 right-2">
																<Badge
																	variant="secondary"
																	class="text-xs font-medium gap-1"
																>
																	<Server class="w-3 h-3" />
																	{game.servers.length}
																</Badge>
															</div>
														{/if}
													</div>
													<div class="p-3">
														<h3 class="font-semibold text-sm text-foreground truncate">
															{game.name}
														</h3>
														<p class="text-xs text-muted-foreground truncate mt-0.5">
															by {game.creator}
														</p>
														<p class="text-xs text-muted-foreground/60 mt-2">
															{formatTimeAgo(game.lastPlayed)}
														</p>
													</div>
												</div>
											</div>
										</DropdownMenu.Trigger>
										<DropdownMenu.Content class="w-48">
											<DropdownMenu.Item on:click={() => launchGame(game.placeId)}>
												<Play class="w-4 h-4 mr-2" />
												Launch Game
											</DropdownMenu.Item>
											{#if game.servers && game.servers.length > 0}
												<DropdownMenu.Item
													on:click={() =>
														events.broadcast('history:launchGame', {
															url: `roblox://experiences/start?placeId=${game.placeId}&gameInstanceId=${game.servers[0].jobId}`,
														})}
												>
													<Globe class="w-4 h-4 mr-2" />
													Rejoin Last Server
												</DropdownMenu.Item>
												<DropdownMenu.Item on:click={() => handleViewServers(game)}>
													<Server class="w-4 h-4 mr-2" />
													View Servers ({game.servers.length})
												</DropdownMenu.Item>
											{/if}
											<DropdownMenu.Separator />
											<DropdownMenu.Item on:click={() => openGamePage(game.placeId)}>
												<ExternalLink class="w-4 h-4 mr-2" />
												Open Game Page
											</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</Card.Root>
		</div>
	{/if}
{/if}

<!-- Clear History Dialog -->
<AlertDialog.Root bind:open={showClearDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Clear Game History?</AlertDialog.Title>
			<AlertDialog.Description>
				This will permanently delete all your locally tracked game and server history. Games from your Roblox account
				will still appear. This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={clearHistory}>Clear History</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Server List Dialog -->
<ServerListDialog bind:open={serverDialogOpen} game={selectedGame} on:joinServer={(e) => events.broadcast('history:launchGame', { url: e.detail.url })} />

<style>
	.game-card {
		--rotate-x: 0deg;
		--rotate-y: 0deg;
		transition: transform 0.2s ease-out;
		transform: perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y));
	}

	.game-card:hover {
		transform: perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y)) scale(1.02);
	}

	.game-card:focus-within {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
		border-radius: 0.5rem;
	}
</style>
