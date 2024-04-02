<script lang="ts">
import {Separator} from '$lib/components/ui/separator/index.js';
import logo from '@/assets/favicon.png';
import {os} from '@neutralinojs/lib';

import IntegrationsIcon from '@/assets/sidebar/integrations.png';
import FastFlagsIcon from '@/assets/sidebar/fastflags.png';
import CommingSoonIcon from "@/assets/sidebar/comingsoon.png"

import SidebarBtn from './SidebarBtn.svelte';

interface SidebarItem {
	label: string;
	id: string;
	icon: string;
}
const sidebarBtns: SidebarItem[] = [
	{label: 'Integrations', id: 'integrations', icon: IntegrationsIcon},
	{label: 'Fast Flags', id: 'fastflags', icon: FastFlagsIcon},
	{label: 'Coming Soon', id: 'none', icon: CommingSoonIcon},
];

export let currentPage: string = 'integrations';

function sidebarItemClicked(e: CustomEvent) {
	if (e.detail === "none") return;
	currentPage = e.detail;
}
</script>

<div class="h-full bg-[#1B1B1B] w-36 fixed top-0 left-0 overflow-x-hidden">
	<a
		href="https://github.com/OrigamingWasTaken/appleblox"
		class="flex justify-center"
		target="_blank"
		rel="noreferrer"
		on:click={() => {
			os.open('https://github.com/OrigamingWasTaken/appleblox').catch(console.error);
		}}>
		<div class="mt-3 flex">
			<img src={logo} class="h-6 mr-1 opacity-85 logo" alt="Svelte Logo" />
			<p class="text-white font-bold font-mono logo">AppleBlox</p>
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

<style>
.logo {
	filter: drop-shadow(0 0 2em #ff6464aa);
}
</style>
