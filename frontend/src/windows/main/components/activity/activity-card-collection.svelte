<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Badge } from '$lib/components/ui/badge';
	import { os } from '@neutralinojs/lib';
	import { createEventDispatcher } from 'svelte';
	import Logger from '../../ts/utils/logger';
	import { Play, Globe, ExternalLink, Server } from 'lucide-svelte';
	import type { GameHistoryEntry } from '../../ts/activity/types';

	export let games: GameHistoryEntry[] = [];

	const dispatch = createEventDispatcher<{
		viewServers: GameHistoryEntry;
		launchGame: { url: string };
	}>();

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

	function handleMouseMove(event: MouseEvent) {
		const card = (event.currentTarget as HTMLElement).closest('.activity-card') as HTMLElement;
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
		const card = (event.currentTarget as HTMLElement).closest('.activity-card') as HTMLElement;
		if (!card) return;
		card.style.setProperty('--rotate-x', '0deg');
		card.style.setProperty('--rotate-y', '0deg');
	}

	function launchGame(placeId: string) {
		dispatch('launchGame', { url: `roblox://experiences/start?placeId=${placeId}` });
	}

	function viewServers(game: GameHistoryEntry) {
		dispatch('viewServers', game);
	}

	async function openGamePage(placeId: string) {
		try {
			await os.open(`https://www.roblox.com/games/${placeId}/`);
		} catch (error) {
			Logger.error('Failed to open game page:', error);
		}
	}
</script>

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full">
	{#each games as game (game.placeId)}
		<div class="activity-card">
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
						<Card.Root class="h-full overflow-hidden transition-shadow hover:shadow-lg border-border/50">
							<div class="aspect-square w-full overflow-hidden bg-muted relative">
								<img src={game.iconUrl} alt={game.name} class="w-full h-full object-cover" />
								{#if game.servers.length > 0}
									<div class="absolute top-2 right-2">
										<Badge variant="secondary" class="text-xs font-medium gap-1">
											<Server class="w-3 h-3" />
											{game.servers.length}
										</Badge>
									</div>
								{/if}
							</div>
							<Card.Content class="p-3">
								<h3 class="font-semibold text-sm text-foreground truncate">{game.name}</h3>
								<p class="text-xs text-muted-foreground truncate mt-0.5">by {game.creator}</p>
								<p class="text-xs text-muted-foreground/60 mt-2">{formatTimeAgo(game.lastPlayed)}</p>
							</Card.Content>
						</Card.Root>
					</div>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content class="w-48">
					<DropdownMenu.Item on:click={() => launchGame(game.placeId)}>
						<Play class="w-4 h-4 mr-2" />
						Launch Game
					</DropdownMenu.Item>
					{#if game.servers.length > 0}
						<DropdownMenu.Item on:click={() => viewServers(game)}>
							<Globe class="w-4 h-4 mr-2" />
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

<style>
	.activity-card {
		--rotate-x: 0deg;
		--rotate-y: 0deg;
		transition: transform 0.2s ease-out;
		transform: perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y));
	}

	.activity-card:hover {
		transform: perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y)) scale(1.02);
	}

	.activity-card:focus-within {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
		border-radius: 0.5rem;
	}
</style>
