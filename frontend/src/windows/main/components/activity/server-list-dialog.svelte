<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import Button from '$lib/components/ui/button/button.svelte';
	import { createEventDispatcher } from 'svelte';
	import { MapPin, Clock, Play } from 'lucide-svelte';
	import type { GameHistoryEntry, ServerInfo } from '../../ts/activity/types';

	export let open = false;
	export let game: GameHistoryEntry | null = null;

	const dispatch = createEventDispatcher<{
		joinServer: { url: string };
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

	function formatRegion(server: ServerInfo): string {
		const { city, region, country } = server.region;
		if (city && country) {
			return `${city}, ${country}`;
		}
		if (region && country) {
			return `${region}, ${country}`;
		}
		return country || 'Unknown';
	}

	function joinServer(server: ServerInfo) {
		if (!game) return;
		const url = `roblox://experiences/start?placeId=${game.placeId}&gameInstanceId=${server.jobId}`;
		dispatch('joinServer', { url });
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-3">
				{#if game}
					<img src={game.iconUrl} alt={game.name} class="w-10 h-10 rounded-lg object-cover" />
					<div class="flex flex-col">
						<span class="truncate max-w-[280px]">{game.name}</span>
						<span class="text-xs text-muted-foreground font-normal">Server History</span>
					</div>
				{/if}
			</Dialog.Title>
		</Dialog.Header>

		<div class="max-h-[300px] overflow-y-auto space-y-2">
			{#if game && game.servers.length > 0}
				{#each game.servers as server, index (server.jobId)}
					<Card.Root class="overflow-hidden">
						<Card.Content class="p-3">
							<div class="flex items-center justify-between">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<MapPin class="w-4 h-4 text-muted-foreground flex-shrink-0" />
										<span class="text-sm font-medium truncate">{formatRegion(server)}</span>
										{#if index === 0}
											<Badge variant="secondary" class="text-xs">Latest</Badge>
										{/if}
									</div>
									<div class="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
										<Clock class="w-3 h-3" />
										<span>{formatTimeAgo(server.joinedAt)}</span>
									</div>
								</div>
								<Button size="sm" variant="secondary" on:click={() => joinServer(server)}>
									<Play class="w-3 h-3 mr-1" />
									Join
								</Button>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			{:else}
				<p class="text-center text-muted-foreground py-4">No servers recorded for this game.</p>
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" on:click={() => (open = false)}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
