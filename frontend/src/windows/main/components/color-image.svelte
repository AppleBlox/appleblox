<script lang="ts">
	import { cn } from '$lib/utils';

	export let src: string;
	export let alt: string;
	export let color = '#000000'; // Default to black
	let className = '';
	export { className as class };
</script>

<div class={cn('relative', className)}>
	<!-- Normal <img> as fallback -->
	<img {src} {alt} class="w-full h-full object-contain" />

	<!-- Colored mask overlay -->
	<div class={cn('absolute inset-0 color-mask')} style={`--mask-src: url(${src}); background-color: ${color};`}></div>
</div>

<style>
	.color-mask {
		/* Use CSS variable for dynamic image */
		-webkit-mask-image: var(--mask-src);
		-webkit-mask-size: contain;
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-position: center;

		mask-image: var(--mask-src);
		mask-size: contain;
		mask-repeat: no-repeat;
		mask-position: center;
	}
</style>
