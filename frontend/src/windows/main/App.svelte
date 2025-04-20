<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Progress } from '$lib/components/ui/progress';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Toaster } from '$lib/components/ui/sonner';
	import { events, os } from '@neutralinojs/lib';
	import { ModeWatcher, setMode } from 'mode-watcher';
	import { blur } from 'svelte/transition';
	import Code from './components/code.svelte';
	import FlagEditorPage from './components/flag-editor/flag-editor-page.svelte';
	import Onboarding from './components/onboarding.svelte';
	import Updater from './components/updater.svelte';
	import Appearance from './pages/Appearance.svelte';
	import BehaviorPage from './pages/Behavior.svelte';
	import Dev from './pages/Dev.svelte';
	import Engine from './pages/Engine.svelte';
	import Support from './pages/Info.svelte';
	import Integrations from './pages/Integrations.svelte';
	import Misc from './pages/Misc.svelte';
	import Mods from './pages/Mods.svelte';
	import Sidebar from './sidebar/Sidebar.svelte';
	import Roblox from './ts/roblox';
	import { sleep } from './ts/utils/';
	import { focusWindow } from './ts/window';
	import { setContext } from 'svelte';

	let currentPage: string;

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
		progress: 1,
		text: 'Launching...',
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
	async function launchRobloxWithHandlers(url?: string) {
		await Roblox.launch(
			// Defines which values should be modified during the launch phase (the loading progress, text, etc...)
			(value) => (launchInfo.isConnected = value),
			(value) => (launchInfo.launching = value),
			(value) => (launchInfo.progress = value),
			(value) => (launchInfo.text = value),
			flagErrorPopup,
			url
		);
	}

	/** Checks if the app is opened with a URI */
	async function checkDeeplink() {
		const urlArgument = window.NL_ARGS.find((arg) => arg.includes('--deeplink='));
		if (!urlArgument) return;
		const url = urlArgument.slice(11);
		if (url.startsWith('appleblox://')) {
			const command = url.slice(12).trim();
			switch (command) {
				case 'launch':
					console.info("[App] Launching Roblox from 'appleblox://launch'");
					await focusWindow();
					await launchRobloxWithHandlers();
					break;
			}
		} else if (url.startsWith('roblox:') || url.startsWith('roblox-player:')) {
			console.info('[App] Launching AppleBlox with Roblox URI.');
			await focusWindow();
			await launchRobloxWithHandlers(url);
		}
		if (urlArgument) {
		}
	}
	checkDeeplink();

	// Sets the theme to the system's mode
	setMode('system');

	// Makes it so links are opened in the default browser and not Appleblox's webview.
	document.addEventListener('click', (event) => {
		if (!event.target) return;
		// @ts-expect-error
		if (event.target.tagName === 'A') {
			// Prevent default behavior (opening link)
			event.preventDefault();

			// @ts-expect-error
			const url = event.target.href;

			// @ts-expect-error
			if ((event.target.href as string).includes('localhost')) return;
			os.open(url);
		}
	});

	// Listen for this dispatch event and change page accordingly.
	events.on('ui:change_page', (evt: CustomEvent) => {
		const { id } = evt.detail;
		currentPage = id || currentPage;
	});
</script>

<main>
	<div>
		<!-- Not-rendered panels. Used to preload settings -->
		<Integrations render={false} />
		<Engine render={false} />
		<Misc render={false} />
		<Mods render={false} />
		<BehaviorPage render={false} />
	</div>
	<Onboarding />
	<Updater />
	<ModeWatcher track={true} />
	<Toaster richColors id="toaster" />
	<!-- Content div -->
	{#if launchInfo.launching}
		<div
			class="h-full w-full flex justify-center items-center fixed top-0 left-0 flex-col"
			transition:blur={{ duration: 300 }}
			id="launch_div"
		>
			<p class="font-bold text-2xl" id="launch_text">{launchInfo.text}</p>
			<Progress max={100} bind:value={launchInfo.progress} class="w-[60%]" id="launch_progress" />
		</div>
	{:else}
		<Sidebar
			bind:currentPage
			bind:isLaunched={launchInfo.isConnected}
			on:launchRoblox={async () => {
				await launchRobloxWithHandlers();
			}}
			id="sidebar"
		/>
		<div class="fixed overflow-y-scroll max-h-full top-0 left-48 w-[83%]">
			{#if currentPage == 'integrations'}
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
	{/if}
	<AlertDialog.Root bind:open={launchInfo.flagPopup.show}>
		<AlertDialog.Content class="h-96 flex flex-col">
			<AlertDialog.Header class="flex-shrink-0">
				<AlertDialog.Title>{launchInfo.flagPopup.title}</AlertDialog.Title>
			</AlertDialog.Header>
			<AlertDialog.Description class="flex-grow">
				<div class="prose prose-sm max-w-none break-words whitespace-normal">
					{@html launchInfo.flagPopup.description}
				</div>
				<Code code={launchInfo.flagPopup.code} class="mt-7 overflow-y-scroll max-h-36" />
			</AlertDialog.Description>
			<AlertDialog.Footer class="flex-shrink-0">
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
</main>
