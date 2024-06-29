<script lang="ts">
	export let label: string;
	export let icon: string;
	export let id: string;
	import {createEventDispatcher} from 'svelte';
	
	export let currentPage: string;
	
	const dispatch = createEventDispatcher<{sidebarClick: string}>();
	</script>
	
	<button
		class="flex items-center justify-center mb-2"
		on:click={() => {
			dispatch('sidebarClick', id);
		}}>
		<img src={icon} alt="Sidebar icon" class="w-[15px] towhite mr-1" />
		<p class={`${currentPage === id ? 'text-red-400 hover:text-red-300' : 'text-black hover:opacity-50 dark:text-gray-300 dark:hover:text-gray-50'} transition duration-100 font-mono text-[14px]`}>{label}</p>
	</button>