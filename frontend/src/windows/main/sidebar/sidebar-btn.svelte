<script lang="ts">
	export let label: string;
	export let icon: string;
	export let id: string;
	import { createEventDispatcher } from 'svelte';
	import ColorImage from '../components/color-image.svelte';

	export let currentPage: string;
	export let position: { total: number; index: number };

	const dispatch = createEventDispatcher<{ sidebarClick: string }>();
</script>

<button
	class={`${currentPage === id ? 'bg-background' : 'rounded-md bg-card'} hover:rounded-none flex items-center hover:bg-opacity-95 hover:bg-muted justify-start p-2 w-full mr-auto`}
	on:click={() => {
		dispatch('sidebarClick', id);
	}}
>
	{#if currentPage === id}
		<div
			class={`absolute right-[-10px] h-14 w-10 bg-background -z-10 ${position.index === 0 ? 'top-20' : position.index === position.total - 1 && 'mb-6'}`}
		></div>
	{/if}
	<ColorImage src={icon} alt="Sidebar icon" color="hsl(var(--foreground))" class="w-4 h-4 mx-4"/>
	<p
		class={`${currentPage === id ? 'text-primary' : 'text-foreground'} transition duration-100 font-mono text-[14px] hover:saturate-150 hover:text-primary`}
	>
		{label}
	</p>
</button>