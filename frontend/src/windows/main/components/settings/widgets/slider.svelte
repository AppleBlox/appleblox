<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { createEventDispatcher } from 'svelte';

	const WHITELIST = '1234567890';

	export let step: number;
	export let max: number;
	export let min: number;
	export let placeholderValue: number[];
	export let defaultValue: number;
	export let value = [defaultValue];
	export let warning: { above: number; message: string } | undefined = undefined;

	$: showWarning = warning && value[0] > warning.above;

	let inputValue = String(value[0]);

	const dispatch = createEventDispatcher<{ changed: { value: number[] } }>();

	function handleKeypress(e: any) {
		if (e.key === 'Enter') {
			e.target.blur();
			return;
		}
		if (!WHITELIST.includes(e.key)) {
			e.preventDefault();
			return;
		}
	}

	function commitInput() {
		let num = parseInt(inputValue, 10);
		if (isNaN(num)) num = min;
		if (num > max) num = max;
		if (num < min) num = min;
		value = [num];
		inputValue = String(num);
		dispatch('changed', { value });
	}

	function onSliderChange(v: number[]) {
		value = v;
		inputValue = String(v[0]);
		dispatch('changed', { value });
	}

	const isStepOne = step === 1;
</script>

<div class="flex flex-grow justify-end items-center">
	<Slider {max} {step} class="w-48 ml-7" value={value} onValueChange={onSliderChange} />
	{#if isStepOne}
		<div class="relative ml-5 mr-4">
			{#if showWarning}
				<p class="absolute -top-5 left-0 right-0 text-center text-[11px] text-warning whitespace-nowrap">{warning?.message}</p>
			{/if}
			<Input
				type="text"
				bind:value={inputValue}
				class="w-32 text-center border-none {showWarning ? 'bg-warning/20 ring-1 ring-warning' : 'bg-input'}"
				placeholder={placeholderValue.toString()}
				on:keypress={handleKeypress}
				on:blur={commitInput}
			/>
		</div>
	{:else}
		<Tooltip.Root>
			<Tooltip.Trigger>
				<Input
					disabled={step !== 1}
					type="text"
					value={String(value[0])}
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
