<script lang="ts">
	export let label: string;
	export let icon: string;
	export let id: string;
	import { createEventDispatcher } from 'svelte';

	export let currentPage: string;

	const dispatch = createEventDispatcher<{ sidebarClick: string }>();
</script>

<button
	class={`${currentPage === id ? "bg-accent" : ''} flex items-center justify-center hover:bg-muted rounded-md py-1 px-4 mt-2`}
	on:click={() => {
		dispatch('sidebarClick', id);
	}}
>
	<img src={icon} alt="Sidebar icon" class="w-[17px] towhite mr-2" />
	<p
		class={`${currentPage === id ? 'text-red-300' : 'text-card-foreground'} hover:text-red-400 transition duration-100 font-mono text-[14px]`}
	>
		{label}
	</p>
</button>
