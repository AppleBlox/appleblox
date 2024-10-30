<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { toast } from 'svelte-sonner';
	import { loadTheme, readCssFile, revealCssFile, setTheme } from './theme';
	import LoadingSpinner from '../loading-spinner.svelte';
	import { PaintBucket, FilePenLine, RefreshCcw } from 'lucide-svelte';

	let cssInputValue: string;
	async function loadCurrentFile() {
		cssInputValue = await readCssFile();
	}

	function onButtonClick() {
		setTheme(cssInputValue);
	}

	function openFileClick() {
		revealCssFile();
	}
</script>

{#await loadCurrentFile()}
	<LoadingSpinner />
{:then}
	<div class="w-full">
		<h3 class="text-xl font-semibold text-emerald-400">Theme CSS</h3>
		<p class="text-[13px] saturate-[20%] font-semibold">Paste your custom theme</p>
		<Textarea class="mt-3 w-full min-h-72" bind:value={cssInputValue} placeholder={`body {
	background: red;
}`}/>
		<Button class="mt-3 w-32 float-end" on:click={onButtonClick}><PaintBucket class="mr-3 h-5" />Save</Button>
		<Button class="mt-3 mr-3 float-end" on:click={openFileClick} variant="outline"
			><FilePenLine class="mr-3 h-5" />Open CSS file</Button
		>
		<Button
			class="mt-3 mr-3 float-end"
			on:click={() => {
				loadTheme();
				readCssFile().then(content => cssInputValue = content)
			}}
			variant="outline"><RefreshCcw class="mr-3 h-5" />Refresh</Button
		>
	</div>
{:catch err}
	<p class="text-red-500 text-xl">An error occured while loading the CSS file: {err}</p>
{/await}
