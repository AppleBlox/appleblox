<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Progress } from '$lib/components/ui/progress';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Toaster } from '$lib/components/ui/sonner';
	import { os, events } from '@neutralinojs/lib';
	import { ModeWatcher, setMode } from 'mode-watcher';
	import Sidebar from './Sidebar/Sidebar.svelte';
	import Code from './components/Code.svelte';
	import Onboarding from './components/Onboarding.svelte';
	import Updater from './components/Updater.svelte';
	import Dev from './pages/Dev.svelte';
	import FastFlags from './pages/FastFlags.svelte';
	import Support from './pages/Info.svelte';
	import Integrations from './pages/Integrations.svelte';
	import Misc from './pages/Misc.svelte';
	import Mods from './pages/Mods.svelte';
	import RobloxPage from './pages/Roblox.svelte';
	import Roblox from './ts/roblox';
	import { sleep } from './ts/utils';
	import FlagEditorPage from './components/flag-editor/flag-editor-page.svelte';
	import { focusWindow } from './ts/window';

	let currentPage: string;

	let flagErrorPopupClicked: boolean | null = null;
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

	async function flagErrorPopup(title: string, description: string, code: string) {
		launchInfo.flagPopup.title = title;
		launchInfo.flagPopup.description = description;
		launchInfo.flagPopup.code = code;
		launchInfo.flagPopup.show = true;
		flagErrorPopupClicked = null;
		while (flagErrorPopupClicked == null) {
			await sleep(100);
		}
		return flagErrorPopupClicked;
	}

	// Checks if the app is opened with the --launch or --roblox argument
	async function checkArgs() {
		if (window.NL_ARGS.includes('--launch')) {
			console.info("[App] Launching Roblox from '--launch'");

			await focusWindow()
			// Defines which values should be modified during the launch phase (the loading progress, text, etc...)
			await Roblox.launch(
				(value) => (launchInfo.isConnected = value),
				(value) => (launchInfo.launching = value),
				(value) => (launchInfo.progress = value),
				(value) => (launchInfo.text = value),
				flagErrorPopup
			);
		}

		const urlArgument = window.NL_ARGS.find((arg) => arg.includes('--deeplink='));
		if (urlArgument) {
			const url = urlArgument.slice(11)
			console.info('[App] Launching AppleBlox with Roblox URI:',url);
			await focusWindow()
			await Roblox.launch(
				(value) => (launchInfo.isConnected = value),
				(value) => (launchInfo.launching = value),
				(value) => (launchInfo.progress = value),
				(value) => (launchInfo.text = value),
				flagErrorPopup,
				url
			);
		}
	}
	checkArgs();

	// Sets the theme to the system's mode
	setMode("system");

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

	events.on('ui:change_page', (evt: CustomEvent) => {
		const { id } = evt.detail;
		currentPage = id || currentPage;
	});
</script>

<main>
	<div>
		<!-- Not-rendered panels. Used to preload settings -->
		<Integrations render={false} />
		<FastFlags render={false} />
		<Misc render={false} />
		<Mods render={false} />
		<RobloxPage render={false} />
	</div>
	<Onboarding />
	<Updater />
	<ModeWatcher track={true} />
	<Toaster richColors />
	<!-- Content div -->
	{#if launchInfo.launching}
		<div class="h-full w-full flex justify-center items-center fixed top-0 left-0 flex-col">
			<p class="font-bold text-2xl">{launchInfo.text}</p>
			<Progress max={100} value={launchInfo.progress} class="w-[60%] bg-primary" />
		</div>
	{:else}
		<Sidebar
			bind:currentPage
			bind:isLaunched={launchInfo.isConnected}
			on:launchRoblox={async () => {
				await Roblox.launch(
					(value) => (launchInfo.isConnected = value),
					(value) => (launchInfo.launching = value),
					(value) => (launchInfo.progress = value),
					(value) => (launchInfo.text = value),
					flagErrorPopup
				);
			}}
			id="sidebar"
		/>
		<div class="fixed overflow-y-scroll max-h-full top-0 left-48 w-[83%]">
			{#if currentPage == 'integrations'}
				<Integrations />
			{:else if currentPage === 'fastflags'}
				<FastFlags />
			{:else if currentPage === 'misc'}
				<Misc />
			{:else if currentPage === 'info'}
				<Support />
			{:else if currentPage === 'mods'}
				<Mods />
			{:else if currentPage === 'dev'}
				<Dev />
			{:else if currentPage === 'roblox'}
				<RobloxPage />
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
						flagErrorPopupClicked = false;
						launchInfo.flagPopup.show = false;
					}}
				>
					Cancel
				</AlertDialog.Cancel>
				<AlertDialog.Action
					on:click={() => {
						flagErrorPopupClicked = true;
						launchInfo.flagPopup.show = false;
					}}
				>
					Ignore
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
</main>
