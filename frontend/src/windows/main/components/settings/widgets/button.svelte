<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { createEventDispatcher } from 'svelte';
	import { type ButtonIcon } from '..';
	import { cn } from '$lib/utils';

	export let label: string;
	export let description: string;
	export let variant: 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' | 'default';
	export let icon: ButtonIcon | null = null;

	const dispatch = createEventDispatcher<{ click: null }>();
</script>

<div class="pt-2">
	<Tooltip.Root>
		<Tooltip.Trigger>
			<Button
				variant={variant || 'default'}
				on:click={() => {
					dispatch('click');
				}}
			>
				{#if icon}
					{#if icon.component}
						<svelte:component this={icon.component} class={cn(icon.props, 'h-5 w-5 mr-2')} />
					{:else if icon.src}
						<img src={icon.src} alt="Button Icon" class={cn(icon.props, 'h-5 w-5 mr-2')} />
					{/if}
				{/if}
				{label}</Button
			>
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>{description}</p>
		</Tooltip.Content>
	</Tooltip.Root>
</div>
