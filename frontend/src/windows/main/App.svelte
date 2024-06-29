<script lang="ts">
	import Sidebar from "./Sidebar/Sidebar.svelte";
	import { Skeleton } from "$lib/components/ui/skeleton/index.js";
	import Integrations from "./pages/Integrations.svelte";
	import { fly } from "svelte/transition";
	import FastFlags from "./pages/FastFlags.svelte";
	import { Toaster } from "$lib/components/ui/sonner";
	import { Progress } from "$lib/components/ui/progress";
	import { hasRoblox } from "./ts/roblox";
	import Misc from "./pages/Misc.svelte";
	import { toast } from "svelte-sonner";
	import { debug, os } from "@neutralinojs/lib";
	import { ModeWatcher, setMode } from "mode-watcher";

	let currentPage: string;
	let launchingRoblox = false;
	let launchProgess = 1;
	let ltext = "Launching...";

	async function launchRoblox() {
		launchingRoblox = true;
		if (!(await hasRoblox())) {
			launchingRoblox = false;
		}
		// Implement launching logic
	}

	// Darkmode
	setMode("system")

</script>

<main>
	<ModeWatcher track={true}/>
	<Toaster richColors />
	<!-- Content div -->
	{#if launchingRoblox}
		<div class="h-full w-full flex justify-center items-center fixed top-0 left-0 flex-col">
			<p class="font-bold text-2xl">{ltext}</p>
			<Progress max={100} value={launchProgess} class="w-[60%] bg-neutral-700" />
		</div>
	{:else}
		<Sidebar
			bind:currentPage
			on:launchRoblox={() => {
				launchRoblox();
			}}
			id="sidebar"
		/>
		<div class="fixed overflow-y-scroll max-h-full top-0 left-36 w-[85%]">
			{#if currentPage == "integrations"}
				<div in:fly={{ y: -750, duration: 1000 }} out:fly={{ y: 400, duration: 400 }}>
					<Integrations />
				</div>
			{:else if currentPage === "fastflags"}
				<div in:fly={{ y: -750, duration: 1000 }} out:fly={{ y: 400, duration: 400 }}>
					<FastFlags />
				</div>
			{:else if currentPage === "misc"}
				<div in:fly={{ y: -750, duration: 1000 }} out:fly={{ y: 400, duration: 400 }}>
					<Misc />
				</div>
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
