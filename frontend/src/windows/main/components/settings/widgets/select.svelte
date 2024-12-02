<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import { createEventDispatcher } from 'svelte';
	import type { SelectElement } from '../types';

	export let items: SelectElement[];
	export let defaultItem: SelectElement;

	const dispatch = createEventDispatcher<{ itemSelected: { item: SelectElement } }>();

	function handleSelect(selected: any) {
		if (!selected?.label || !selected?.value || !selected) return;
		// not ...selected because of type errors
		dispatch('itemSelected', { item: { label: selected.label, value: selected.value.value } });
	}
</script>

<Select.Root {items} selected={defaultItem} onSelectedChange={handleSelect}>
	<Select.Trigger class="w-[180px] dark:bg-neutral-900 bg-neutral-300 ml-auto mr-4 border-none text-left">
		<Select.Value class="text-foreground" />
	</Select.Trigger>
	<Select.Content class="bg-popover border-none text-foreground">
		<Select.Group>
			{#each items || [] as item (item.value)}
				<Select.Item value={item} label={item.label}>{item.label}</Select.Item>
			{/each}
		</Select.Group>
	</Select.Content>
	<Select.Input name="favoriteFruit" />
</Select.Root>
