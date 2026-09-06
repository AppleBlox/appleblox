<script lang="ts">
	import { onMount } from 'svelte';
	import { getValue, setValue } from './settings';
	import { listDisplays, type DisplayInfo } from '../ts/roblox/virtualdisplay';
	import { getMode } from '../ts/utils';

	let displays: DisplayInfo[] = [];
	let loading = true;
	let error = '';
	let selectedId = '';

	onMount(async () => {
		try {
			displays = await listDisplays();
			try {
				const savedId = await getValue<string>('engine.graphics.vd_display');
				if (savedId) selectedId = savedId;
			} catch {}
		} catch (err) {
			error = `Failed to detect displays: ${err}`;
		} finally {
			loading = false;
		}
	});

	function select(id: string) {
		selectedId = id;
		setValue('engine.graphics.vd_display', id);
	}

	$: isDev = getMode() === 'dev';
	$: visible = displays.length > 1 || isDev;
	$: maxWidth = Math.max(...displays.map((d) => d.width), 1);
	$: maxHeight = Math.max(...displays.map((d) => d.height), 1);
	$: scaleFactor = Math.min(200 / maxWidth, 120 / maxHeight);
</script>

<div class="w-full py-3">
	{#if loading}
		<div class="flex justify-center items-center h-[160px]">
			<div class="w-8 h-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
		</div>
	{:else if error}
		<p class="text-[13px] text-destructive text-center">{error}</p>
	{:else if !visible}{:else}
		<div class="flex justify-center items-end gap-4 px-4 py-6 rounded-lg dark:bg-neutral-900/50 bg-neutral-200/50">
			{#each displays as display, i (display.id)}
				{@const w = Math.max(display.width * scaleFactor, 60)}
				{@const h = Math.max(display.height * scaleFactor, 40)}
				{@const isSelected = String(display.id) === selectedId || (selectedId === '' && i === 0)}
				<button
					class="group flex flex-col items-center gap-2 transition-all duration-150"
					on:click={() => select(String(display.id))}
				>
					<div
						class="relative rounded-lg border-2 transition-all duration-150 flex items-center justify-center overflow-hidden {isSelected
							? 'border-primary bg-primary/10'
							: 'border-foreground/20 dark:bg-neutral-800 bg-neutral-300 hover:border-foreground/40'}"
						style="width: {w}px; height: {h}px;"
					>
						{#if isSelected}
							<div class="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent" />
						{/if}
						<svg
							class="w-5 h-5 {isSelected ? 'text-primary' : 'text-foreground/40'}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<rect x="2" y="3" width="20" height="14" rx="2" />
							<path d="M8 21h8M12 17v4" />
						</svg>
					</div>
					<div class="text-center">
						<p
							class="text-xs font-medium {isSelected ? 'text-primary' : 'text-foreground/70'} truncate max-w-[120px]"
						>
							Display {display.id}
						</p>
						<p class="text-[10px] text-foreground/50">{display.width}&times;{display.height}</p>
					</div>
				</button>
			{/each}
		</div>
		{#if displays.length > 1}
			<p class="text-[11px] text-foreground/40 text-center mt-2">Click a display to select it for the virtual display</p>
		{/if}
	{/if}
</div>
