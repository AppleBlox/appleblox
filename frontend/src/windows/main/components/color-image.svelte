<script lang="ts">
	import { cn } from '$lib/utils';

	export let src: string;
	export let alt: string;
	export let color = '#000000'; // Default to black if no color provided

	let className = '';
	export { className as class };
</script>

<div class={cn('relative', className)}>
	<img 
		{src} 
		{alt} 
		class="w-full h-full object-contain"
		style="visibility: hidden;"
	/>
	<div
		class="absolute inset-0"
		style:mask-image={`url(${src})`}
		style:mask-size="contain"
		style:mask-repeat="no-repeat"
		style:mask-position="center"
		style:background-color={color}
	/>
</div>