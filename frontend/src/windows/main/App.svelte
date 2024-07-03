<script lang="ts">
	import Sidebar from "./Sidebar/Sidebar.svelte";
	import { Skeleton } from "$lib/components/ui/skeleton/index.js";
	import Integrations from "./pages/Integrations.svelte";
	import { fly } from "svelte/transition";
	import FastFlags from "./pages/FastFlags.svelte";
	import { Toaster } from "$lib/components/ui/sonner";
	import { Progress } from "$lib/components/ui/progress";
	import { hasRoblox, parseFFlags } from "./ts/roblox";
	import Misc from "./pages/Misc.svelte";;
	import { app, debug, os, window as w } from "@neutralinojs/lib";
	import { ModeWatcher, setMode } from "mode-watcher";
	import { pathExists } from "./ts/utils";
	import shellFS from "./ts/fs";

	let currentPage: string;
	let launchingRoblox = false;
	let launchProgess = 1;
	let ltext = "Launching...";

	async function checkArgs() {
		if (window.NL_ARGS.includes("--launch")) {
			debug.log("Launching Roblox from '--launch?'");
			w.hide().catch(console.error);
			await launchRoblox();
			setTimeout(() => {
				app.exit();
			}, 7000);
		}
	}
	checkArgs();

	async function launchRoblox() {
		try {
			console.log("Launching Roblox");
			launchingRoblox = true;
			if (!(await hasRoblox())) {
				console.log("Roblox is not installed. Exiting launch process.");
				launchingRoblox = false;
			}

			launchProgess = 20;
			if (await pathExists("/Applications/Roblox.app/Contents/MacOS/ClientSettings/ClientAppSettings.json")) {
				console.log(
					"Removing current ClientAppSettings.json file in /Applications/Roblox.app/Contents/MacOS/ClientSettings/ClientAppSettings.json"
				);
				await shellFS.remove("/Applications/Roblox.app/Contents/MacOS/ClientSettings/")
				ltext = "Removing current ClientAppSettings...";
			}
			launchProgess = 40;
			ltext = "Copying fast flags...";
			console.log("Copying fast flags");
			await shellFS.createDirectory("/Applications/Roblox.app/Contents/MacOS/ClientSettings");
			console.log("Parsing saved FFlags");
			const fflags = { ...(await parseFFlags(false)), ...(await parseFFlags(true)) };
			console.log(fflags);
			await shellFS.writeFile(
				"/Applications/Roblox.app/Contents/MacOS/ClientSettings/ClientAppSettings.json",
				JSON.stringify(fflags)
			);
			console.log("Wrote FFlags to /Applications/Roblox.app/Contents/MacOS/ClientSettings/ClientAppSettings.json");
			launchProgess = 60;
			setTimeout(() => {
				os.execCommand("open /Applications/Roblox.app");
				console.log("Opening Roblox");
				launchProgess = 100;
				ltext = "Roblox Launched";
				setTimeout(() => {
					launchingRoblox = false;
					shellFS.remove("/Applications/Roblox.app/Contents/MacOS/ClientSettings/");
					console.log("Deleted /Applications/Roblox.app/Contents/MacOS/ClientSettings/");
				}, 1000);
			}, 1000);
		} catch (err) {
			console.error("An error occured while launching Roblox");
			console.error(err);
		}
	}

	// Darkmode
	setMode("system");
</script>

<main>
	<ModeWatcher track={true} />
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
