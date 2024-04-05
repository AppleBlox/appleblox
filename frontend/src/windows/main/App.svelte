<script lang="ts">
import Sidebar from './Sidebar/Sidebar.svelte';
import {Skeleton} from '$lib/components/ui/skeleton/index.js';
import Integrations from './pages/Integrations.svelte';
import {fly} from 'svelte/transition';
import FastFlags from './pages/FastFlags.svelte';
import { ModeWatcher } from 'mode-watcher';
import { Toaster } from "$lib/components/ui/sonner";
let currentPage: string;
</script>

<main>
	<Toaster richColors/>
	<ModeWatcher defaultMode="dark"/>
	<Sidebar bind:currentPage />
	<!-- Content div -->
	<div class="fixed overflow-y-scroll max-h-full top-0 left-36 w-[85%]">
		{#if currentPage == 'integrations'}
			<div in:fly={{ y: -750, duration: 1000 }} out:fly={{ y: 400, duration: 400 }}>
				<Integrations />
			</div>
		{:else if currentPage === 'fastflags'}
			<div in:fly={{ y: -750, duration: 1000 }} out:fly={{ y: 400, duration: 400 }}>
				<FastFlags />
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
</main>