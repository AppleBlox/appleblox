<script lang="ts">
	import { Input, type FormInputEvent } from '$lib/components/ui/input/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { createEventDispatcher } from 'svelte';

	export let placeholder: string;
	export let defaultValue: string;
	export let value = defaultValue;
	export let whitelist: string | null = null;
	export let blacklist: string | null = null;

	let doWarnAnimation = false;
	function warnAnimation() {
		doWarnAnimation = true;
		setTimeout(() => {
			doWarnAnimation = false;
		}, 800);
	}

	const dispatch = createEventDispatcher<{ inputChanged: { input: string } }>();

	function handleInput(e: any) {
		// FormInputEvent causes the app to freeze, so we set to any
		const input = e.target.value as string;
		dispatch('inputChanged', { input });
	}

	function handleKeypress(e: FormInputEvent<KeyboardEvent>) {
		if (e.key === 'Enter' || e.key === 'Escape') {
			if (e.target) {
				// @ts-expect-error: Property exists
				e.target.blur();
				return;
			}
		}
		// Verify that the key is allowed
		if (whitelist && !whitelist.includes(e.key)) {
			warnAnimation();
			e.preventDefault();
		} else if (blacklist && blacklist.includes(e.key)) {
			warnAnimation();
			e.preventDefault();
		}
	}
</script>

<Tooltip.Root bind:open={doWarnAnimation}>
	<Tooltip.Trigger>
		<Input
			bind:value
			class={`dark:bg-neutral-900 bg-neutral-300 text-center border-none w-[250px] font-sans mr-4 transition duration-150 ${doWarnAnimation ? 'animate-shake ring-red-900' : ''}`}
			{placeholder}
			on:keypress={handleKeypress}
			on:change={handleInput}
		/>
	</Tooltip.Trigger>
	<Tooltip.Content>
		<p class="text-red-200">This character is not allowed!</p>
	</Tooltip.Content>
</Tooltip.Root>
