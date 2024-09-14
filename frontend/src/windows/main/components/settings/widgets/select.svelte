<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import { createEventDispatcher } from 'svelte';
	import { type SelectElement } from '..';

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
	<Select.Trigger class="w-[180px] dark:bg-neutral-900 bg-neutral-300 ml-auto mr-4 border-none">
		<Select.Value class="text-black dark:text-white" />
	</Select.Trigger>
	<Select.Content class="dark:bg-gray-900 bg-neutral-200 grayscale border-none dark:text-white text-black">
		<Select.Group>
			{#each items || [] as item (item.value)}
				<Select.Item value={item} label={item.label}>{item.label}</Select.Item>
			{/each}
		</Select.Group>
	</Select.Content>
	<Select.Input name="favoriteFruit" />
</Select.Root>
