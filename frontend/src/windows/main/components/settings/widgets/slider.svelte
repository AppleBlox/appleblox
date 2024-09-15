<script lang="ts">
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { createEventDispatcher } from 'svelte';

	const WHITELIST = '1234567890';

	export let step: number;
	export let max: number;
	export let min: number;
	export let placeholderValue: number[];
	export let defaultValue: number;
	export let value = [defaultValue];

	const dispatch = createEventDispatcher<{ changed: { value: number[] } }>();

	function handleKeypress(e: any) {
		if (e.key === 'Enter') {
			e.target.blur();
		}
		// Cancel event if char is not in whitelist or the string has already too much .
		if (!WHITELIST.includes(e.key)) {
			e.preventDefault();
			return;
		}
	}

	$: {
		if (value[0] > max) {
			value[0] = max;
		} else if (value[0] < min) {
			value[0] = min;
		}
		if (typeof value[0] === 'number') {
			dispatch('changed', { value });
		}
	}

	const isStepOne = step === 1;
</script>

<div class="flex flex-grow justify-end">
	<!-- We bind so we can link the slider to the input -->
	<Slider {max} {step} class="w-48 ml-7" bind:value />
	{#if isStepOne}
		<Input
			disabled={step !== 1}
			type="number"
			bind:value={value[0]}
			class="w-32 text-cente bg-input border-none ml-5 mr-4"
			placeholder={placeholderValue.toString()}
			on:keypress={handleKeypress}
		/>
	{:else}
		<Tooltip.Root>
			<Tooltip.Trigger>
				<Input
					disabled={step !== 1}
					type="number"
					bind:value={value[0]}
					class="w-32 text-center bg-input ml-5 mr-4"
					placeholder={placeholderValue.toString()}
					on:keypress={handleKeypress}
				/>
			</Tooltip.Trigger>

			<Tooltip.Content>
				<p>You cannot enter values for decimal sliders.</p>
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
</div>
