<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { cn } from '$lib/utils';
	import { createEventDispatcher } from 'svelte';

	let className = '';
	export { className as class };
	export let tooltip: string;
	export let builders: any[] = [];
	const dispatch = createEventDispatcher<{ click: null }>();
</script>

<Tooltip.Root openDelay={200}>
	<Tooltip.Trigger asChild let:builder>
		<Button
			on:click={() => {
				dispatch('click');
			}}
			builders={[builder, ...builders]}
			variant="outline"
			class={cn('h-10 w-10 p-3', className)}><slot></slot></Button
		>
	</Tooltip.Trigger>
	<Tooltip.Content>
		<p>{tooltip}</p>
	</Tooltip.Content>
</Tooltip.Root>
