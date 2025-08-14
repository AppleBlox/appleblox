<script lang="ts">
	import { fade } from 'svelte/transition';
	import { loadMods, type Mod } from '../../ts/workshop';
	import ModCard from './mod-card.svelte';
	import Cat from '@/assets/panel/cat.gif';
	import { quintOut } from 'svelte/easing';
	import Input from '$lib/components/ui/input/input.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { TriangleAlert } from 'lucide-svelte';

	let mods: Mod[] = [];
	let loadStatus = { error: false, loaded: false };
	let searchTerm = '';
	(async () => {
		const loadModsResult = await loadMods();
		if (!loadModsResult.success) {
			loadStatus.error = true;
			return;
		}
		loadStatus.loaded = true;
		mods = loadModsResult.mods;
	})();
</script>

<div>
	{#if loadStatus.error}
		<div
			class="fixed inset-0 bg-background bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center"
			transition:fade={{ duration: 300, easing: quintOut }}
		>
			<div
				class="flex flex-col items-center space-y-4 text-center"
				transition:fade={{ duration: 500, delay: 200, easing: quintOut }}
			>
				<TriangleAlert class="text-red-600 h-14 w-14" />
				<h2 class="text-2xl font-bold text-foreground">Connection Error</h2>
				<p class="text-muted-foreground max-w-md">
					Unable to reach the marketplace API. Please check your internet connection and try again.
				</p>
				<Button
					class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
					on:click={() => window.location.reload()}
				>
					Retry
				</Button>
			</div>
		</div>
	{:else if loadStatus.loaded}
		<Input type="text" placeholder="Search for mods..." class="pl-8 mb-4" bind:value={searchTerm} />
		<div class="grid grid-cols-3 gap-5">
			{#each mods as mod}
				{#if searchTerm.length < 1 || mod.name.toLowerCase().includes(searchTerm.trim().toLowerCase())}
					<ModCard {mod} />
				{/if}
			{/each}
		</div>
	{:else}
		<div
			class="fixed inset-0 bg-background bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center"
			transition:fade={{ duration: 300, easing: quintOut }}
		>
			<div class="flex flex-col items-center space-y-4" transition:fade={{ duration: 500, delay: 200, easing: quintOut }}>
				<img src={Cat} alt="Loading..." class="w-32 h-32 opacity-75 animate-pulse" />
			</div>
		</div>
	{/if}
</div>
