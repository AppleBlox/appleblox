<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { os, type OpenDialogOptions } from '@neutralinojs/lib';
	import { Trash2, Upload } from 'lucide-svelte';
	import path from 'path-browserify';
	import { createEventDispatcher } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Logger from '@/windows/main/ts/utils/logger';

	export let file: string | null = null;
	export let extensions: string[] | null = null;

	const dispatch = createEventDispatcher<{ fileChosen: { path: string }; fileRemoved: null }>();

	async function handleClick() {
		try {
			if (file) {
				// Remove file
				file = null;
				dispatch('fileRemoved');
			} else {
				// Add file
				let opts: OpenDialogOptions = {
					multiSelections: false,
				};
				if (extensions) opts.filters = [{ name: 'Files filter', extensions }];
				const entries = await os.showOpenDialog('Choose your file', opts);
				if (entries.length < 1) return;
				file = entries[0];
				dispatch('fileChosen', { path: entries[0] });
			}
		} catch (err) {
			Logger.withContext("panel").error(err);
			toast.error(String(err));
		}
	}
</script>

<Button
	class={`ml-auto mr-4 bg-background border w-64 text-foreground ${file ? 'bg-red-500 border-neutral-800 border-2' : ''}`}
	variant="ghost"
	on:click={handleClick}
>
	<!-- Display file path -->
	{#if file}
		<Trash2 class="w-5 h-5 mr-2" />
		<p class="inline-block align-middle overflow-hidden whitespace-nowrap overflow-ellipsis [direction:rtl] w-full">
			{path.basename(file || '')}
		</p>
	{:else}
		<Upload class="w-5 h-5 mr-2" />
		Choose file
	{/if}
</Button>
