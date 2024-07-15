<script lang="ts">
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { createEventDispatcher } from "svelte";
	import logo from "@/assets/favicon.png";
	import { os } from "@neutralinojs/lib";
	import { version } from "../../../../../package.json";

	import IntegrationsIcon from "@/assets/sidebar/integrations.png";
	import FastFlagsIcon from "@/assets/sidebar/fastflags.png";
	import RobloxIcon from "@/assets/sidebar/roblox.png";
	import PlayIcon from "@/assets/sidebar/play.png";
	import ModsIcon from "@/assets/sidebar/mods.png";

	import MiscIcon from "@/assets/sidebar/misc.png";
	import CreditsIcon from "@/assets/sidebar/credits.png";

	import SidebarBtn from "./SidebarBtn.svelte";
	import Button from "$lib/components/ui/button/button.svelte";

	export let isLaunched = false;

	interface SidebarItem {
		label: string;
		id: string;
		icon: string;
	}
	const sidebarBtns: SidebarItem[] = [
		{ label: "Integrations", id: "integrations", icon: IntegrationsIcon },
		{ label: "Fast Flags", id: "fastflags", icon: FastFlagsIcon },
		{ label: "Mods", id: "mods", icon: ModsIcon },
		{ label: "Misc", id: "misc", icon: MiscIcon },
		{ label: "Credits", id: "credits", icon: CreditsIcon },
	];

	export let currentPage: string = "integrations";
	export let id: string;

	function sidebarItemClicked(e: CustomEvent) {
		if (e.detail === "none") return;
		currentPage = e.detail;
	}

	const dispatch = createEventDispatcher<{ launchRoblox: boolean }>();
</script>

<div class="h-full bg-[#F3F4F6] dark:bg-[#1B1B1B] w-36 fixed top-0 left-0 overflow-x-hidden select-none flex flex-col" {id}>
	<div class="flex-grow">
		<a
			href="https://github.com/OrigamingWasTaken/appleblox"
			class="flex justify-center"
			target="_blank"
			rel="noreferrer"
			on:click={() => {
				os.open("https://github.com/OrigamingWasTaken/appleblox").catch(console.error);
			}}
		>
			<div class="mt-3 flex">
				<img src={logo} class="h-6 mr-1 opacity-85 logo bg-[#dcdcdc] dark:bg-[#1B1B1B] rounded-lg" alt="Svelte Logo" />
				<p class="text-black dark:text-white font-bold font-mono logo">AppleBlox</p>
			</div>
		</a>
		<div class="m-4">
			<Separator class="my-4 bg-gray-500" />
		</div>
		<div class="mt-3 grid grid-cols-1">
			{#each sidebarBtns as { label, id, icon }}
				<SidebarBtn bind:currentPage {label} {id} {icon} on:sidebarClick={sidebarItemClicked} />
			{/each}
		</div>
	</div>
	<div class="flex flex-col items-center mb-4">
		<p class="text-sm text-gray-500 mb-2">v{version}</p>
		
		<Button
			class={`${isLaunched ? "bg-blue-400 hover:bg-blue-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-800"} font-mono`}
			on:click={() => {
				if (isLaunched) return;
				dispatch("launchRoblox", true);
			}}
		>
			{#if isLaunched}
				<p class="font-mono">Active</p>
				<img src={PlayIcon} alt="Roblox Icon" class="ml-1 mt-[1px] w-5 h-5 towhite-always" />
			{:else}
				<p class="font-mono">Play</p>
				<img src={RobloxIcon} alt="Roblox Icon" class="ml-1 mt-[1px] w-5 h-5 towhite-always" />
			{/if}
		</Button>
	</div>
</div>

<style>
	.logo {
		filter: drop-shadow(0 0 2em #ff6464aa);
	}
</style>
