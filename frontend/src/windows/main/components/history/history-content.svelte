<script lang="ts">
	import { onMount } from 'svelte';
	import { events } from '@neutralinojs/lib';
	import { Trash2, RefreshCw, Gamepad2 } from 'lucide-svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Card from '$lib/components/ui/card';
	import Button from '$lib/components/ui/button/button.svelte';
	import type { GameHistoryEntry } from '../../ts/activity';
	import ActivityCardCollection from '../activity/activity-card-collection.svelte';
	import ServerListDialog from '../activity/server-list-dialog.svelte';
	import Logger from '@/windows/main/ts/utils/logger';
	import { getValue } from '../settings';

	let games: GameHistoryEntry[] = [];
	let loading = true;
	let loadError = false;
	let showClearDialog = false;
	let serverDialogOpen = false;
	let selectedGame: GameHistoryEntry | null = null;
	let trackingEnabled = true;

	function handleLaunchGame(event: CustomEvent<{ url: string }>) {
		events.broadcast('history:launchGame', { url: event.detail.url });
	}

	function handleJoinServer(event: CustomEvent<{ url: string }>) {
		events.broadcast('history:launchGame', { url: event.detail.url });
	}

	async function checkTrackingEnabled() {
		try {
			trackingEnabled = (await getValue<boolean>('history.tracking.enabled')) !== false;
		} catch {
			trackingEnabled = true;
		}
	}

	async function loadHistory() {
		loading = true;
		loadError = false;
		await checkTrackingEnabled();
		try {
			const { ActivityHistoryManager } = await import('../../ts/activity');
			games = await ActivityHistoryManager.getHistory();
		} catch (error) {
			Logger.error('Failed to load activity history:', error);
			loadError = true;
			games = [];
		} finally {
			loading = false;
		}
	}

	async function clearHistory() {
		showClearDialog = false;
		try {
			const { ActivityHistoryManager } = await import('../../ts/activity');
			await ActivityHistoryManager.clearHistory();
			games = [];
		} catch (error) {
			Logger.error('Failed to clear activity history:', error);
		}
	}

	function handleViewServers(event: CustomEvent<GameHistoryEntry>) {
		selectedGame = event.detail;
		serverDialogOpen = true;
	}

	onMount(() => {
		loadHistory();

		// Listen for setting changes
		const interval = setInterval(checkTrackingEnabled, 1000);
		return () => clearInterval(interval);
	});
</script>

<div class="relative w-full">
	<!-- Blur overlay when tracking is disabled -->
	{#if !trackingEnabled}
		<div
			class="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg transition-all duration-300"
		>
			<Card.Root class="max-w-sm border-border/50">
				<Card.Content class="pt-6 text-center">
					<div class="w-12 h-12 mb-4 mx-auto rounded-full bg-muted flex items-center justify-center">
						<Gamepad2 class="w-6 h-6 text-muted-foreground" />
					</div>
					<h3 class="font-semibold text-foreground mb-2">Tracking Disabled</h3>
					<p class="text-sm text-muted-foreground">
						Enable tracking above to record your game history.
					</p>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}

	<div
		class="w-full transition-all duration-300"
		class:opacity-50={!trackingEnabled}
		class:pointer-events-none={!trackingEnabled}
	>
		<!-- Header with actions -->
		<div class="flex items-center justify-end gap-2 mb-4">
			<Button variant="outline" size="sm" on:click={loadHistory} disabled={loading}>
				<RefreshCw class="w-4 h-4 mr-2 {loading ? 'animate-spin' : ''}" />
				Refresh
			</Button>
			{#if games.length > 0}
				<Button variant="destructive" size="sm" on:click={() => (showClearDialog = true)}>
					<Trash2 class="w-4 h-4 mr-2" />
					Clear
				</Button>
			{/if}
		</div>

		<!-- Content -->
		{#if loading}
			<div class="flex items-center justify-center py-12 w-full">
				<div class="text-center">
					<RefreshCw class="w-8 h-8 mx-auto mb-3 animate-spin text-muted-foreground" />
					<p class="text-muted-foreground">Loading history...</p>
				</div>
			</div>
		{:else if loadError}
			<div class="flex flex-col items-center justify-center py-12 text-center w-full">
				<!-- TODO: Replace with custom icon -->
				<div class="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
					<Gamepad2 class="w-8 h-8 text-muted-foreground" />
				</div>
				<h2 class="text-lg font-semibold text-foreground mb-2">Failed to load history</h2>
				<p class="text-muted-foreground max-w-md mb-4">
					There was an error loading your game history.
				</p>
				<Button variant="outline" on:click={loadHistory}>
					<RefreshCw class="w-4 h-4 mr-2" />
					Retry
				</Button>
			</div>
		{:else if games.length === 0}
			<div class="flex flex-col items-center justify-center py-12 text-center w-full">
				<!-- TODO: Replace with custom icon -->
				<div class="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
					<Gamepad2 class="w-8 h-8 text-muted-foreground" />
				</div>
				<h2 class="text-lg font-semibold text-foreground mb-2">No games played yet</h2>
				<p class="text-muted-foreground max-w-md">
					Your recently played games will appear here. Play some games through AppleBlox to start
					building your history.
				</p>
			</div>
		{:else}
			<ActivityCardCollection {games} on:viewServers={handleViewServers} on:launchGame={handleLaunchGame} />
		{/if}
	</div>
</div>

<AlertDialog.Root bind:open={showClearDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Clear Game History?</AlertDialog.Title>
			<AlertDialog.Description>
				This will permanently delete all your game and server history. This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={clearHistory}>Clear History</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<ServerListDialog bind:open={serverDialogOpen} game={selectedGame} on:joinServer={handleJoinServer} />
