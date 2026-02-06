<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Toaster } from '$lib/components/ui/sonner';
	import Cat from '@/assets/panel/cat.gif';
	import { events, Icon, os } from '@neutralinojs/lib';
	import { ModeWatcher, setMode } from 'mode-watcher';
	import { onMount, setContext } from 'svelte';
	import { quintOut } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	import { toast } from 'svelte-sonner';
	import Code from './components/code.svelte';
	import FlagEditorPage from './components/flag-editor/flag-editor-page.svelte';
	import Onboarding from './components/onboarding/onboarding.svelte';
	import Sidebar from './components/sidebar/sidebar.svelte';
	import Updater from './components/updater.svelte';
	import Appearance from './pages/Appearance.svelte';
	import BehaviorPage from './pages/Behavior/page.svelte';
	import Dev from './pages/Dev.svelte';
	import Engine from './pages/Engine.svelte';
	import Support from './pages/Info.svelte';
	import Integrations from './pages/Integrations.svelte';
	import Misc from './pages/Misc.svelte';
	import Mods from './pages/Mods.svelte';
	import Workshop from './pages/Workshop.svelte';
	import Account from './pages/Account.svelte';
	import Home from './pages/Home.svelte';
	import Roblox from './ts/roblox';
	import { PathManager } from './ts/roblox/path-manager';
	import { sleep } from './ts/utils/';
	import Logger from '@/windows/main/ts/utils/logger';

	let currentPage: string;
	let onboardingLoaded: boolean = false;
	let showMainContent = true;

	// Initialize Roblox PathManager early
	onMount(async () => {
		try {
			Logger.info('Initializing Roblox PathManager...');
			await PathManager.initialize();

			const robloxPath = PathManager.getPath();

			if (!robloxPath) {
				Logger.warn('Roblox not found on this Mac');

				// Show notification
				try {
					await os.showNotification(
						'Roblox Not Found',
						'AppleBlox could not find Roblox. Please install Roblox or specify its location in settings.',
						Icon.WARNING
					);
				} catch (err) {
					Logger.error('Failed to show notification:', err);
				}

				// Show toast and redirect to Behavior settings
				toast.warning('Roblox not found. Please install or specify the path in Behavior settings.', {
					duration: 5000,
				});

				// Redirect to Behavior page after short delay
				setTimeout(() => {
					currentPage = 'roblox';
					events.broadcast('ui:change_page', { id: 'roblox' });
				}, 1000);
			} else {
				Logger.info(`Roblox found at: ${robloxPath}`);
			}
		} catch (err) {
			Logger.error('Failed to initialize Roblox PathManager:', err);
			toast.error('Error initializing Roblox path detection. Please check settings.');
		}
	});

	$: {
		setContext('pageData', {
			getCurrentPage: () => {
				return currentPage;
			},
		});
	}

	let flagErrorPopupRemoveFlags: boolean | null = null;
	let flagErrorPopupShowRemoveButton = false;
	const launchInfo = {
		launching: false,
		isConnected: false,
		flagPopup: {
			show: false,
			title: '',
			description: '',
			code: '',
		},
	};

	/** Trigger a popup (related to invalid flags) */
	async function flagErrorPopup(title: string, description: string, code: string, flagNames?: string[]) {
		launchInfo.flagPopup.title = title;
		launchInfo.flagPopup.description = description;
		launchInfo.flagPopup.code = code;
		launchInfo.flagPopup.show = true;
		if (flagNames && flagNames.length > 0) flagErrorPopupShowRemoveButton = true;
		while (launchInfo.flagPopup.show) {
			await sleep(100);
		}
		if (flagErrorPopupRemoveFlags && flagNames) {
			Roblox.FFlags.removeFlagsFromConfig(flagNames);
		}
	}

	/** Launches roblox with the correct handlers */
	async function launchRobloxWithHandlers(checkFlags = true, url?: string) {
		await Roblox.launch(
			(value) => (launchInfo.isConnected = value),
			(value) => (launchInfo.launching = value),
			flagErrorPopup,
			url,
			checkFlags
		);
	}

	setMode('system');

	document.addEventListener('click', (event) => {
		if (!event.target) return;
		const targetElement = event.target as HTMLElement;
		if (targetElement.tagName === 'A') {
			event.preventDefault();
			const url = targetElement.getAttribute('href');
			if (url && !url.includes('localhost')) {
				os.open(url).catch((err) => Logger.error('Failed to open external link:', err));
			}
		}
	});

	events.on('ui:change_page', (evt: CustomEvent) => {
		const { id } = evt.detail;
		currentPage = id || currentPage;
	});

	events.on('mods:restoring', (evt: CustomEvent) => {
		launchInfo.launching = evt.detail;
	});

	events.on('app:reload', () => {
		showMainContent = false;
		setTimeout(() => {
			showMainContent = true;
		}, 10);
	});

	// Handle game launches from History page
	events.on('history:launchGame', (evt: CustomEvent) => {
		const { url } = evt.detail;
		launchRobloxWithHandlers(true, url);
	});
</script>

{#if showMainContent}
	<main>
		<div>
			<Home render={false} />
			<Account render={false} />
			<Integrations render={false} />
			<Engine render={false} />
			<Misc render={false} />
			<Mods render={false} />
			<BehaviorPage render={false} />
		</div>
		<Updater />
		<ModeWatcher track={true} />
		<Toaster richColors id="toaster" />
		{#if onboardingLoaded}
			<div class="relative">
				<Sidebar
					bind:currentPage
					bind:isLaunched={launchInfo.isConnected}
					on:launchRoblox={async (e) => {
						await launchRobloxWithHandlers(true, e.detail.url);
					}}
					id="sidebar"
				/>
				<div class="fixed overflow-y-scroll max-h-full top-0 left-48 w-[83%]" class:blur-sm={launchInfo.launching}>
					{#if currentPage === 'home'}
						<Home />
					{:else if currentPage === 'account'}
						<Account />
					{:else if currentPage == 'integrations'}
						<Integrations />
					{:else if currentPage === 'engine'}
						<Engine />
					{:else if currentPage === 'misc'}
						<Misc />
					{:else if currentPage === 'info'}
						<Support />
					{:else if currentPage === 'mods'}
						<Mods />
					{:else if currentPage === 'appearance'}
						<Appearance />
					{:else if currentPage === 'dev'}
						<Dev />
					{:else if currentPage === 'roblox'}
						<BehaviorPage />
					{:else if currentPage === 'flags_editor'}
						<FlagEditorPage />
					{:else if currentPage === 'Workshop'}
						<Workshop />
					{:else}
						<div class="flex items-center m-32 space-x-4 opacity-30">
							<Skeleton class="h-12 w-12 rounded-full" />
							<div class="space-y-2">
								<Skeleton class="h-4 w-[250px]" />
								<Skeleton class="h-4 w-[200px]" />
							</div>
						</div>
					{/if}
				</div>

				{#if launchInfo.launching}
					<div
						class="fixed inset-0 bg-background bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center"
						transition:fade={{ duration: 300, easing: quintOut }}
					>
						<div
							class="flex flex-col items-center space-y-4"
							transition:fade={{ duration: 500, delay: 200, easing: quintOut }}
						>
							<img src={Cat} alt="Loading..." class="w-32 h-32 opacity-75 animate-pulse" />
						</div>
					</div>
				{/if}
			</div>
			<AlertDialog.Root bind:open={launchInfo.flagPopup.show}>
				<AlertDialog.Content class="h-auto flex flex-col">
					<AlertDialog.Header class="flex-shrink-0">
						<AlertDialog.Title>{launchInfo.flagPopup.title}</AlertDialog.Title>
					</AlertDialog.Header>
					<AlertDialog.Description class="flex-grow">
						<div class="prose prose-sm max-w-none break-words whitespace-normal">
							{@html launchInfo.flagPopup.description}
						</div>
						<Code code={launchInfo.flagPopup.code} class="mt-7 overflow-y-scroll max-h-36" />
					</AlertDialog.Description>
					<AlertDialog.Footer class="">
						<AlertDialog.Cancel
							on:click={() => {
								flagErrorPopupRemoveFlags = false;
								launchInfo.flagPopup.show = false;
							}}
						>
							Ignore
						</AlertDialog.Cancel>
						{#if flagErrorPopupShowRemoveButton}
							<AlertDialog.Action
								on:click={() => {
									flagErrorPopupRemoveFlags = true;
									launchInfo.flagPopup.show = false;
								}}
							>
								Remove
							</AlertDialog.Action>
						{/if}
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		{:else}
			<Onboarding bind:onboardingLoaded />
		{/if}
	</main>
{/if}
