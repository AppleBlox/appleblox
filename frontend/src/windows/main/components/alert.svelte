<script lang="ts">
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Check, TriangleAlert } from 'lucide-svelte';

	export let variant: Alert.Variant;
	export let title: string;
	export let description: string;
</script>

<Alert.Root {variant} class="mt-4">
	{#if variant === 'success'}
		<Check class="h-5 w-5" />
	{:else}
		<TriangleAlert class="h-5 w-5" />
	{/if}
	<Alert.Title class="ml-2">{title}</Alert.Title>
	<Alert.Description class="ml-2">{description}</Alert.Description>
</Alert.Root>
