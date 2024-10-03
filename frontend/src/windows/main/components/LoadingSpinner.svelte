<script lang="ts">
	import CatGif from '@/assets/panel/cat.gif';
	import { sleep } from '../ts/utils';
	import { cn } from '$lib/utils';

	let className = '';
	export { className as class };
</script>

{#await sleep(500)}
	<div></div>
{:then}
	<img src={CatGif} alt="Loading gif" class={cn('w-12 h-12', className)} />
{/await}
