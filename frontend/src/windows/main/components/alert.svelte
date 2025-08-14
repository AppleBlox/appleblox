<script lang="ts">
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { TriangleAlert } from 'lucide-svelte';

	export let variant: Alert.Variant;
	export let title: string;
	export let description: string;
</script>

<Alert.Root {variant} class="mt-4">
	<TriangleAlert class="h-5 w-5" />
	<Alert.Title class="ml-2">{title}</Alert.Title>
	<Alert.Description class="ml-2">{description}</Alert.Description>
</Alert.Root>
