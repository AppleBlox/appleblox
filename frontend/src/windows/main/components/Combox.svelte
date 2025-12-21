<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';
	import type { Selected } from 'bits-ui';
	import { Check, ChevronsUpDown } from 'lucide-svelte';
	import { createEventDispatcher, tick } from 'svelte';

	let className = '';
	export { className as class };
	export let popoverClass = '';

	export let items: Selected<string>[];
	export let placeholder: string;
	export let name: string;
	export let open = false;
	export let selected: Selected<string> | undefined = undefined;

	let value = '';

	$: selectedValue = selected?.label ?? placeholder;

	function closeAndFocusTrigger(triggerId: string) {
		open = false;
		tick().then(() => {
			document.getElementById(triggerId)?.focus();
		});
	}

	const dispatch = createEventDispatcher<{ select: Selected<string> }>();
</script>

<Popover.Root bind:open let:ids>
	<Popover.Trigger asChild let:builder>
		<Button
			builders={[builder]}
			variant="outline"
			role="combobox"
			aria-expanded={open}
			class={cn('w-[200px] justify-between', className)}
		>
			{selectedValue}
			<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
		</Button>
	</Popover.Trigger>
	<Popover.Content class={cn('w-[200px] p-0', popoverClass)}>
		<Command.Root>
			<Command.Input placeholder={`Search ${name}...`} />
			<Command.Empty>No {name} found.</Command.Empty>
			<Command.Group>
				{#each items as item}
					<Command.Item
						value={item.value}
						onSelect={(currentValue) => {
							value = currentValue;
							selected = item;
							dispatch('select', item);
							closeAndFocusTrigger(ids.trigger);
						}}
					>
						<Check class={cn('mr-2 h-4 w-4', selected?.value !== item.value && 'text-transparent')} />
						{item.label}
					</Command.Item>
				{/each}
			</Command.Group>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
