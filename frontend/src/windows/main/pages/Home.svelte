<script lang="ts">
	import { onMount } from 'svelte';
	import { events, os } from '@neutralinojs/lib';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card/index';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Switch } from '$lib/components/ui/switch';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { getValue, setValue, loadSettings } from '../components/settings';
	import { ActivityHistoryManager, type GameHistoryEntry } from '../ts/activity';
	import { hasRobloxCookie } from '../ts/tools/keychain';
	import Roblox from '../ts/roblox';
	import Logger from '@/windows/main/ts/utils/logger';
	import {
		Play,
		Plus,
		Settings,
		Gamepad2,
		Globe,
		MessageSquare,
		Sparkles,
		ExternalLink,
		Server,
		X,
		GripVertical,
	} from 'lucide-svelte';

	export let render = true;

	let games: GameHistoryEntry[] = [];
	let isLoading = true;
	let hasAccount = false;

	interface PinnedSetting {
		id: string;
		path: string;
		label: string;
		description: string;
		icon: 'sparkles' | 'discord' | 'globe' | 'settings';
		iconColor: string;
	}

	const AVAILABLE_SETTINGS: PinnedSetting[] = [
		{
			id: 'delegate',
			path: 'roblox.behavior.delegate',
			label: 'Delegate Launching',
			description: 'Let AppleBlox enhance Roblox',
			icon: 'sparkles',
			iconColor: 'text-primary bg-primary/10',
		},
		{
			id: 'discord_rpc',
			path: 'integrations.discord.enabled',
			label: 'Discord RPC',
			description: 'Show game activity on Discord',
			icon: 'discord',
			iconColor: 'text-[#5865F2] bg-[#5865F2]/10',
		},
		{
			id: 'region',
			path: 'roblox.region.enabled',
			label: 'Region Selection',
			description: 'Join preferred server region',
			icon: 'globe',
			iconColor: 'text-green-500 bg-green-500/10',
		},
		{
			id: 'return_website',
			path: 'roblox.behavior.return_to_website',
			label: 'Return to Website',
			description: 'Open roblox.com when closing',
			icon: 'settings',
			iconColor: 'text-orange-500 bg-orange-500/10',
		},
		{
			id: 'close_on_exit',
			path: 'roblox.behavior.close_on_exit',
			label: 'Exit with Roblox',
			description: 'Close AppleBlox when Roblox closes',
			icon: 'settings',
			iconColor: 'text-red-500 bg-red-500/10',
		},
		{
			id: 'disable_desktop',
			path: 'roblox.behavior.disable_desktop_app',
			label: 'Disable Desktop App',
			description: 'Close Roblox when leaving games',
			icon: 'settings',
			iconColor: 'text-yellow-500 bg-yellow-500/10',
		},
	];

	let pinnedSettingIds: string[] = [];
	let settingValues: Record<string, boolean> = {};
	let showSettingsPicker = false;
	let tempPinnedIds: string[] = [];

	const DEFAULT_PINNED = ['delegate', 'discord_rpc', 'region'];

	$: pinnedSettings = pinnedSettingIds
		.map((id) => AVAILABLE_SETTINGS.find((s) => s.id === id))
		.filter(Boolean) as PinnedSetting[];

	onMount(async () => {
		if (!render) return;
		await loadData();
	});

	async function loadData() {
		isLoading = true;
		try {
			const history = await ActivityHistoryManager.getHistory();
			games = history.slice(0, 20);
			hasAccount = await hasRobloxCookie();

			try {
				const saved = await getValue<string[]>('home.settings.pinned_settings');
				pinnedSettingIds = saved && saved.length > 0 ? saved : DEFAULT_PINNED;
			} catch {
				pinnedSettingIds = DEFAULT_PINNED;
			}

			await loadSettingValues();
		} catch (err) {
			Logger.error('Failed to load home data:', err);
		}
		isLoading = false;
	}

	async function loadSettingValues() {
		for (const setting of AVAILABLE_SETTINGS) {
			try {
				settingValues[setting.id] = (await getValue<boolean>(setting.path as `${string}.${string}.${string}`)) === true;
			} catch {
				settingValues[setting.id] = false;
			}
		}
		settingValues = settingValues;
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

	async function toggleSetting(setting: PinnedSetting, enabled: boolean) {
		if (setting.id === 'region' && enabled && !hasAccount) {
			events.broadcast('ui:change_page', { id: 'account' });
			return;
		}

		settingValues[setting.id] = enabled;

		if (setting.id === 'delegate') {
			await Roblox.Delegate.toggle(enabled);
		}

		await setValue(setting.path as `${string}.${string}.${string}`, enabled, true);
	}

	function openSettingsPicker() {
		tempPinnedIds = [...pinnedSettingIds];
		showSettingsPicker = true;
	}

	function toggleTempPinned(id: string) {
		if (tempPinnedIds.includes(id)) {
			tempPinnedIds = tempPinnedIds.filter((p) => p !== id);
		} else {
			tempPinnedIds = [...tempPinnedIds, id];
		}
	}

	async function savePinnedSettings() {
		pinnedSettingIds = [...tempPinnedIds];
		await setValue('home.settings.pinned_settings', pinnedSettingIds, true);
		showSettingsPicker = false;
	}

	async function removePinnedSetting(id: string) {
		pinnedSettingIds = pinnedSettingIds.filter((p) => p !== id);
		await setValue('home.settings.pinned_settings', pinnedSettingIds, true);
	}

	function getSettingIcon(icon: string) {
		switch (icon) {
			case 'sparkles':
				return Sparkles;
			case 'discord':
				return MessageSquare;
			case 'globe':
				return Globe;
			default:
				return Settings;
		}
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
	<div class="p-8 pb-24 space-y-8">
		{#if isLoading}
			<div class="flex items-center justify-center py-24">
				<div class="w-6 h-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
			</div>
		{:else}
			<!-- Pinned Settings Section -->
			<section class="space-y-4">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-semibold">Quick Settings</h2>
					<Button variant="ghost" size="sm" on:click={openSettingsPicker}>
						<Plus class="w-4 h-4 mr-1.5" />
						Customize
					</Button>
				</div>

				{#if pinnedSettings.length === 0}
					<Card.Root class="border-border/50 border-dashed">
						<Card.Content class="py-8 text-center">
							<Settings class="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
							<p class="text-sm text-muted-foreground">No pinned settings</p>
							<Button variant="outline" size="sm" class="mt-3" on:click={openSettingsPicker}>
								<Plus class="w-4 h-4 mr-1.5" />
								Add Settings
							</Button>
						</Card.Content>
					</Card.Root>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{#each pinnedSettings as setting (setting.id)}
							<Card.Root class="border-border/50 group relative">
								<button
									class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
									on:click={() => removePinnedSetting(setting.id)}
								>
									<X class="w-3 h-3 text-muted-foreground" />
								</button>
								<Card.Content class="p-4">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-3">
											<div class="w-9 h-9 rounded-lg flex items-center justify-center {setting.iconColor}">
												<svelte:component this={getSettingIcon(setting.icon)} class="w-5 h-5" />
											</div>
											<div>
												<p class="font-medium text-sm">{setting.label}</p>
												<p class="text-xs text-muted-foreground">
													{#if setting.id === 'region' && !hasAccount}
														Requires account
													{:else}
														{setting.description}
													{/if}
												</p>
											</div>
										</div>
										<Switch
											checked={settingValues[setting.id] || false}
											disabled={setting.id === 'region' && !hasAccount}
											onCheckedChange={(enabled) => toggleSetting(setting, enabled)}
										/>
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Recent Games Section -->
			<section class="space-y-4">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-semibold">Recent Games</h2>
					{#if games.length > 0}
						<Button variant="ghost" size="sm" on:click={() => events.broadcast('ui:change_page', { id: 'history' })}>
							View All
						</Button>
					{/if}
				</div>

				{#if games.length === 0}
					<Card.Root class="border-border/50 border-dashed">
						<Card.Content class="py-12 text-center">
							<Gamepad2 class="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
							<p class="text-muted-foreground">No recent games</p>
							<p class="text-sm text-muted-foreground/70">Play some games to see them here</p>
						</Card.Content>
					</Card.Root>
				{:else}
					<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
						{#each games as game (game.placeId)}
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
											<Card.Root
												class="h-full overflow-hidden transition-shadow hover:shadow-lg border-border/50"
											>
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
													<p class="text-xs text-muted-foreground/60 mt-2">
														{formatTimeAgo(game.lastPlayed)}
													</p>
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
											<DropdownMenu.Item
												on:click={() =>
													events.broadcast('history:launchGame', {
														url: `roblox://experiences/start?placeId=${game.placeId}&gameInstanceId=${game.servers[0].jobId}`,
													})}
											>
												<Globe class="w-4 h-4 mr-2" />
												Rejoin Last Server
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
			</section>
		{/if}
	</div>
{/if}

<!-- Settings Picker Dialog -->
<AlertDialog.Root bind:open={showSettingsPicker}>
	<AlertDialog.Content class="max-w-md">
		<AlertDialog.Header>
			<AlertDialog.Title>Customize Quick Settings</AlertDialog.Title>
			<AlertDialog.Description>Choose which settings to pin to your Home page for quick access.</AlertDialog.Description>
		</AlertDialog.Header>

		<div class="space-y-2 py-4 max-h-[300px] overflow-y-auto">
			{#each AVAILABLE_SETTINGS as setting (setting.id)}
				<button
					class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
					on:click={() => toggleTempPinned(setting.id)}
				>
					<Checkbox checked={tempPinnedIds.includes(setting.id)} />
					<div class="w-8 h-8 rounded-lg flex items-center justify-center {setting.iconColor}">
						<svelte:component this={getSettingIcon(setting.icon)} class="w-4 h-4" />
					</div>
					<div class="flex-1">
						<p class="font-medium text-sm">{setting.label}</p>
						<p class="text-xs text-muted-foreground">{setting.description}</p>
					</div>
				</button>
			{/each}
		</div>

		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<Button on:click={savePinnedSettings}>Save</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

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
