<script lang="ts">
	import { Progress } from '$lib/components/ui/progress';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Toaster } from '$lib/components/ui/sonner';
	import { os } from '@neutralinojs/lib';
	import { ModeWatcher, setMode } from 'mode-watcher';
	import { fly } from 'svelte/transition';
	import Sidebar from './Sidebar/Sidebar.svelte';
	import Dev from './pages/Dev.svelte';
	import FastFlags from './pages/FastFlags.svelte';
	import Integrations from './pages/Integrations.svelte';
	import Misc from './pages/Misc.svelte';
	import Mods from './pages/Mods.svelte';
	import Support from './pages/Support.svelte';
	import { launchRoblox } from './ts/roblox/launch';
	import Onboarding from './util/Onboarding.svelte';
	import Updater from './util/Updater.svelte';
	import Roblox from './pages/Roblox.svelte';

	let currentPage: string;

	const launchInfo = {
		launching: false,
		progress: 1,
		text: 'Launching...',
		isConnected: false,
	};

	// Checks if the app is opened with the --launch or --roblox argument
	async function checkArgs() {
		if (window.NL_ARGS.includes('--launch')) {
			console.log("Launching Roblox from '--launch'");

			// Defines which values should be modified during the launch phase (the loading progress, text, etc...)
			await launchRoblox(
				(value) => (launchInfo.isConnected = value),
				(value) => (launchInfo.launching = value),
				(value) => (launchInfo.progress = value),
				(value) => (launchInfo.text = value)
			);
		}

		const robloxArg = window.NL_ARGS.find((arg) => arg.includes('roblox='));
		if (robloxArg) {
			console.info("Launching Roblox from '--roblox'");
			const robloxUrl = robloxArg.slice(9);

			await launchRoblox(
				(value) => (launchInfo.isConnected = value),
				(value) => (launchInfo.launching = value),
				(value) => (launchInfo.progress = value),
				(value) => (launchInfo.text = value),
				robloxUrl
			);
		}
	}
	checkArgs();

	// Sets the theme to the system's mode
	setMode('system');

	document.addEventListener('click', (event) => {
		if (!event.target) return;
		// @ts-expect-error
		if (event.target.tagName === 'A') {
			// Prevent default behavior (opening link)
			event.preventDefault();

			// @ts-expect-error
			const url = event.target.href;
			console.log(`Opening link: ${url}`);

			// @ts-expect-error
			if ((event.target.href as string).includes('localhost')) return;
			os.open(url);
		}
	});
</script>

<main>
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
				await launchRoblox(
					(value) => (launchInfo.isConnected = value),
					(value) => (launchInfo.launching = value),
					(value) => (launchInfo.progress = value),
					(value) => (launchInfo.text = value)
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
			{:else if currentPage === 'support'}
					<Support />
			{:else if currentPage === 'mods'}
					<Mods />
			{:else if currentPage === 'dev'}
					<Dev />
			{:else if currentPage === 'roblox'}
					<Roblox />
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
</main>
