<script lang="ts">
import {debug, os, storage, window as w} from '@neutralinojs/lib';
import Button from '$lib/components/ui/button/button.svelte';
import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
import * as Table from '$lib/components/ui/table/index.js';
import Edit from '@/assets/panel/edit.png';
import Help from '@/assets/panel/help.png';
import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
import More from '@/assets/panel/more.png';
import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
import {addFlag, getFlags, removeFlag, setFlag} from '../../ts/fflags';
import type {FFlag} from '@/types/settings';
import Input from '$lib/components/ui/input/input.svelte';
import {ScrollArea} from '$lib/components/ui/scroll-area/index.js';
import {toast} from 'svelte-sonner';

let fflags: FFlag[] = [
	{
		enabled: true,
		flag: 'Loading...',
	},
];

function setTableFlags() {
	getFlags()
		.then((flags) => {
			debug.log('Flags: ' + JSON.stringify(flags));
			if (flags) {
				fflags = flags;
			}
		})
		.catch(console.error);
}

setTableFlags();

let addedFlag: string;
async function btnAddFlag() {
	const add = await addFlag(addedFlag);
	if (!add) {
		toast.error('This flag already exists!');
	} else {
		setTableFlags();
	}
}

function updateEnable(f: FFlag, checked: boolean) {
	setFlag(f.flag, checked);
	fflags[fflags.findIndex((flag) => flag.flag === f.flag)].enabled = checked;
}
</script>

<div class="flex gap-3 mt-3">
	<AlertDialog.Root>
		<AlertDialog.Trigger asChild let:builder>
			<Button variant="default" builders={[builder]}>
				<img src={Edit} alt="One icon" class="w-5 mr-2" />
				Advanced FFlags text editor</Button>
		</AlertDialog.Trigger>
		<AlertDialog.Content class="max-w-2xl">
			<AlertDialog.Header>
				<AlertDialog.Title>FastFlags Editor</AlertDialog.Title>
				<AlertDialog.Description>
					Here you can add, remove, enable or disable certain FFlags. Be careful when modifying these as they can crash
					your game if you don't know what you're doing.
				</AlertDialog.Description>
			</AlertDialog.Header>

			<Table.Root>
				<Table.Caption>
					<div class="flex bg-[#161515] my-2 rounded-md p-3 justify-center">
						<Input placeholder="Enter your flag" class="mr-3 w-[300px]" bind:value={addedFlag} />
						<Button variant="secondary" on:click={btnAddFlag}>Add Flag</Button>
					</div>
				</Table.Caption>
				<Table.Header>
					<Table.Row class="block">
						<Table.Head class="w-[100px]">Enabled</Table.Head>
						<Table.Head class="w-full">Flag</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body class="block overflow-auto h-48">
					{#if fflags.length < 1}
						<Table.Row>
							<Table.Cell></Table.Cell>
							<Table.Cell>You have no custom fast flags.</Table.Cell>
						</Table.Row>
					{/if}
					{#each fflags as ff}
						<Table.Row class="w-full">
							<Table.Cell role="checkbox" class="font-medium"
								><Checkbox
									checked={ff.enabled}
									onCheckedChange={(checked) => {
										updateEnable(ff, Boolean(checked));
									}}
									class="rounded-md mr-5" /></Table.Cell>
							<Table.Cell class="w-full">{ff.flag}</Table.Cell>
							<Table.Cell>
								<DropdownMenu.Root>
									<DropdownMenu.Trigger asChild let:builder>
										<Button
											size="icon"
											variant="outline"
											class="ml-auto rounded-md border-none h-7 w-7"
											builders={[builder]}>
											<img src={More} alt="more icon lol" class="h-4 w-4 towhite" />
										</Button>
									</DropdownMenu.Trigger>
									<DropdownMenu.Content>
										<DropdownMenu.Group>
											<DropdownMenu.Label>Options</DropdownMenu.Label>
											<DropdownMenu.Separator />
											<DropdownMenu.Item
												class="cursor-pointer"
												on:click={() => {
													removeFlag(ff.flag);
													fflags = fflags.filter((f) => f.flag !== ff.flag);
												}}><p class="text-red-600">Remove</p></DropdownMenu.Item>
										</DropdownMenu.Group>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
			<AlertDialog.Footer>
				<AlertDialog.Action>Save</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
	<Button
		on:click={() => {
			os.open('https://github.com/MaximumADHD/Roblox-FFlag-Tracker');
		}}
		variant={'secondary'}
		class="bg-slate-900 text-slate-300 font-semibod grayscale">
		<img src={Help} alt="Two icon" class="towhite w-5 mr-2" />
		About Fast Flags
	</Button>
</div>
