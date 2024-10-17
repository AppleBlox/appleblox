<script lang="ts">
	import * as Accordion from '$lib/components/ui/accordion';
	import ContributorsCollection from './contributors-collection.svelte';
	import type { Contributor } from './types';

	export let contributors: Contributor[];
	export let label: string;
	let className: string;
	export { className as class };
</script>

<Accordion.Root>
	<Accordion.Item value="item-1">
		<Accordion.Trigger class={className}>{label}</Accordion.Trigger>
		<Accordion.Content>
			<ContributorsCollection {contributors} />
		</Accordion.Content>
	</Accordion.Item>
</Accordion.Root>
