<script lang="ts">
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { createEventDispatcher } from 'svelte';

	export let defaultValue: boolean;
	export let checked = defaultValue;

	const dispatch = createEventDispatcher<{ clicked: { state: boolean } }>();
</script>

<Switch
	bind:checked
	onCheckedChange={(state) => {
		dispatch('clicked', { state });
	}}
	class="ml-auto mr-4"
/>
