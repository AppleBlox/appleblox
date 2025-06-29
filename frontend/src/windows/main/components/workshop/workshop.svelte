<script lang="ts">
	import { fade } from 'svelte/transition';
	import { loadMods, type Mod } from '../../ts/workshop';
	import ModCard from './mod-card.svelte';
	import Cat from '@/assets/panel/cat.gif';
	import { quintOut } from 'svelte/easing';
	import Input from '$lib/components/ui/input/input.svelte';

	let mods: Mod[] = [];
	let loadStatus = { error: false, loaded: false };
	let searchTerm = "";
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
	{#if loadStatus.loaded}
	<Input type="text" placeholder="Search for mods..." class="pl-8 mt-2 mb-4" bind:value={searchTerm} />
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

