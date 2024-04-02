<script lang="ts">
import type {SettingsPanel} from '@/types/settings';
import {Input} from '$lib/components/ui/input/index.js';
import Separator from '$lib/components/ui/separator/separator.svelte';
import Switch from '$lib/components/ui/switch/switch.svelte';
import * as Select from '$lib/components/ui/select/index.js';
import {debug} from '@neutralinojs/lib';
export let panel: SettingsPanel;

let sections: any = {};
for (const section of panel.sections || []) {
	sections[section.id] = {};
	for (const inter of section.interactables || []) {
		sections[section.id][inter.id] = {};
		switch (inter.options.type) {
			case 'boolean':
				sections[section.id][inter.id].value = inter.options.state;
				break;
			case 'string':
			case 'dropdown':
			case 'number':
				sections[section.id][inter.id].value = inter.options.default;
				break;
		}
	}
}

</script>

<button on:click={()=>{debug.log(JSON.stringify(sections))}}>
	see sections
</button>
<div class="font-mono grid grid-cols-1 h-full text-start m-5">
	<div class="bg-gray-900 grayscale p-2 rounded-md">
		<p class="text-3xl font-bold">{panel.name}</p>
		<p class="text-[15px]">{panel.description}</p>
	</div>
	{#each panel.sections || [] as section}
		<div class="mt-5">
			<p class="text-xl font-bold text-red-400">{section.name}</p>
			<p class="text-[13px]">{section.description}</p>
			{#each section.interactables || [] as inter}
				<Separator class="my-3 bg-gray-300 opacity-25" />
				<div class="flex items-center">
					<div>
						<p class="font-semibold text-red-300">{inter.label}</p>
						<p class="text-[13px]">{inter.description}</p>
					</div>
					{#if inter.options.type === 'boolean'}
						<Switch class="ml-auto mr-4" bind:checked={sections[section.id][inter.id].value}/>
					{:else if inter.options.type === 'string'}
						<Input
							class="bg-gray-900 grayscale border-none w-[250px] ml-auto mr-4 font-sans" bind:value={sections[sections[section.id][inter.id].value]}/>
					{:else if inter.options.type === 'dropdown'}
						<Select.Root>
							<Select.Trigger class="w-[180px] bg-gray-900 grayscale ml-auto mr-4 border-none">
								<Select.Value placeholder={inter.options.default} />
							</Select.Trigger>
							<Select.Content class="bg-gray-900 grayscale border-none text-white">
								<Select.Group>
									{#each inter.options.list || [] as item}
										<Select.Item value={item} label={item}>{item}</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
							<Select.Input name="favoriteFruit" />
						</Select.Root>
					{/if}
				</div>
			{/each}
		</div>
	{/each}
</div>
