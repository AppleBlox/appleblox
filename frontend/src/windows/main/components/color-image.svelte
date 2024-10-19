<script lang="ts">
	import { cn } from '$lib/utils';

	export let src: string;
	export let alt: string;
	export let color = '';

	let className = '';
	export { className as class };
</script>

<div class={cn('relative', className)}>
	<img {src} {alt} class="w-full h-full object-contain" />
	<div
		class={`absolute inset-0 bg-${color}`}
		style="mask-image: url({src}); mask-size: contain; mask-repeat: no-repeat; mask-position: center;"
	></div>
</div>
