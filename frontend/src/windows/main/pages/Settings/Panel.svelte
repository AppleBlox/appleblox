<script lang="ts" type="module">
	import type { SettingsPanel } from "@/types/settings";

	import { Input } from "$lib/components/ui/input/index.js";
	import Separator from "$lib/components/ui/separator/separator.svelte";
	import Switch from "$lib/components/ui/switch/switch.svelte";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Slider } from "$lib/components/ui/slider/index.js";
	import { createEventDispatcher } from "svelte";
	import LoadingSpinner from "../../util/LoadingSpinner.svelte";
	import { loadSettings } from "../../ts/settings";
	import Button from "$lib/components/ui/button/button.svelte";
	import { debug, os } from "@neutralinojs/lib";
	import FfButtonsCustom from "./FFButtonsCustom.svelte";
	import { setFlags } from "../../ts/fflags";
	import * as Tooltip from "$lib/components/ui/tooltip";

	export let panel: SettingsPanel;

	const dispatch = createEventDispatcher<{ settingsChanged: Object; buttonClicked: string }>();

	let settingsLoaded = true;
	let sections: any = {};
	for (const section of panel.sections || []) {
		sections[section.id] = {};
		for (const inter of section.interactables || []) {
			// sections[section.id][inter.id] = undefined;
			switch (inter.options.type) {
				case "boolean":
					sections[section.id][inter.id] = inter.options.state;
					break;
				case "string":
				case "dropdown":
					sections[section.id][inter.id] = inter.options.default;
					break;
				case "number":
					sections[section.id][inter.id] = [inter.options.default];
					break;
			}
		}
	}
	loadSettings(panel.id)
		.then((s) => {
			if (s) {
				sections = s;
			}
			settingsLoaded = true;
		})
		.catch((err) => {
			settingsLoaded = true;
			console.error(err);
		});

	$: {
		if (settingsLoaded) {
			dispatch("settingsChanged", sections);
		}
	}
</script>

{#if settingsLoaded}
	<div class="font-mono grid grid-cols-1 h-full text-start m-5">
		<div class="bg-[#d7d7d7] dark:bg-gray-900 grayscale p-2 rounded-md">
			<p class="text-3xl font-bold text-black dark:text-white">{panel.name}</p>
			<p class="text-[15px] text-neutral-700 dark:text-white">{panel.description}</p>
		</div>
		{#each panel.sections || [] as section}
			<div class="mt-5">
				<p class="text-xl font-bold text-red-600 dark:text-red-400">{section.name}</p>
				<p class="text-[13px] text-black dark:text-neutral-50">{section.description}</p>
				{#each section.interactables || [] as inter}
					{#if inter.options.type !== "button" && inter.options.type !== "ff_buttons_custom"}
						<Separator class="my-3 bg-gray-300 opacity-25" el={undefined} decorative={true} />
					{/if}
					<div class="flex items-center">
						{#if inter.options.type !== "button" && inter.options.type !== "ff_buttons_custom"}
							<div>
								<p class="font-semibold text-[#1f1717] dark:text-red-100">{inter.label}</p>
								<p class="text-[13px] text-neutral-700 dark:text-neutral-200">{@html inter.description}</p>
							</div>
						{/if}
						{#if inter.options.type == "button"}
							<div class="pt-2">
								<Tooltip.Root>
									<Tooltip.Trigger>
										<Button
											variant={inter.options.style || "default"}
											on:click={() => {
												dispatch("buttonClicked", inter.id);
											}}>{inter.label}</Button
										>
									</Tooltip.Trigger>
									<Tooltip.Content>
										<p>{inter.description}</p>
									</Tooltip.Content>
								</Tooltip.Root>
							</div>
						{:else if inter.options.type == "ff_buttons_custom"}
							<FfButtonsCustom />
						{:else if inter.options.type === "boolean"}
							<Switch class="ml-auto mr-4" bind:checked={sections[section.id][inter.id]} />
						{:else if inter.options.type === "string"}
							<Input
								class="dark:bg-neutral-900 bg-neutral-300 text-center border-none w-[250px] ml-auto mr-4 font-sans"
								bind:value={sections[section.id][inter.id]}
								placeholder={inter.options.default}
							/>
						{:else if inter.options.type === "dropdown"}
							<Select.Root items={inter.options.list} bind:selected={sections[section.id][inter.id]}>
								<Select.Trigger class="w-[180px] dark:bg-neutral-900 bg-neutral-300 ml-auto mr-4 border-none">
									<Select.Value class="text-black dark:text-white" placeholder={inter.options.default.label} />
								</Select.Trigger>
								<Select.Content class="dark:bg-gray-900 bg-neutral-200 grayscale border-none dark:text-white text-black">
									<Select.Group>
										{#each inter.options.list || [] as item}
											<Select.Item value={item} label={item.label}>{item.label}</Select.Item>
										{/each}
									</Select.Group>
								</Select.Content>
								<Select.Input name="favoriteFruit" />
							</Select.Root>
						{:else if inter.options.type === "number"}
							<div class="flex flex-grow justify-end">
								<Slider
									step={inter.options.step}
									max={inter.options.max}
									min={inter.options.min}
									bind:value={sections[section.id][inter.id]}
									class="max-w-[50%]"
								/>
								<Input
									class="max-w-[20%] text-center bg-gray-900 border-none grayscale ml-5 mr-4"
									bind:value={sections[section.id][inter.id][0]}
									placeholder={inter.options.default.toString()}
									disabled={true}
								/>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
{:else}
	<div class="flex h-[100vh] w-full opacity-30 grayscale items-center justify-center">
		<LoadingSpinner />
	</div>
{/if}
