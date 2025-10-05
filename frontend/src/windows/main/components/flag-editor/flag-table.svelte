<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import * as Table from '$lib/components/ui/table';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import { clipboard } from '@neutralinojs/lib';
	import beautify from 'json-beautify';
	import { Braces, Clipboard, Delete, Ellipsis, Plus, Search } from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { correctAndParseJSON } from '../../ts/utils/json';

	type FastFlag = string | boolean | null | number;
	interface EditorFlag {
		flag: string;
		enabled: boolean;
		value: FastFlag;
	}

	export let flags: EditorFlag[] = [];

	let selectedFlags: Set<number> = new Set();
	let searchTerm: string = '';

	const dispatch = createEventDispatcher<{ update: EditorFlag[] }>();

	let showFlagDialog: boolean = false;
	let flagDialogName: string = '';
	let flagDialogValue: FastFlag = '';

	function isFlagNameValid(name: string): boolean {
		const validPattern = /^[A-Za-z0-9_;]+$/;
		return validPattern.test(name) && name.length > 0;
	}

	function addFlag(): void {
		showFlagDialog = true;
	}

	function removeSelected(): void {
		if (selectedFlags.size < 1) return;
		flags = flags.filter((_, index) => !selectedFlags.has(index));
		selectedFlags.clear();
		toast.success('Removed selected flag(s)', { duration: 1000 });
		dispatch('update', flags);
	}

	function contextMenuRemove(flag: string): void {
		flags = flags.filter((f) => f.flag !== flag);
		toast.success('Removed flag', { duration: 750 });
		dispatch('update', flags);
	}

	let currentFlagInput: string;
	let toRenameFlagName: string;
	let openRenameFlagDialog = false;
	function showRenameFlagDialog(flag: string): void {
		currentFlagInput = flag;
		toRenameFlagName = flag;
		openRenameFlagDialog = true;
	}

	function contextMenuRename(flag: string, newName: string): void {
		if (!isFlagNameValid(newName)) {
			toast.error('A flag cannot be null or contain special characters in its name.', { duration: 3000 });
			return;
		}
		let flagToModifyIndex = flags.findIndex((f) => f.flag === flag);
		if (flagToModifyIndex === -1) {
			console.error(`Couldn't find the flag "${flag}" to edit.`);
			return;
		}
		const currentFlag = flags[flagToModifyIndex];
		flags[flagToModifyIndex] = { flag: newName, enabled: currentFlag.enabled, value: currentFlag.value };
		flags = flags; // Trigger reactivity
		openRenameFlagDialog = false;
		toast.success('Renamed flag', { duration: 750 });
		dispatch('update', flags);
	}

	async function contextMenuCopy(flag: string): Promise<void> {
		const flagToCopy = flags.find((f) => f.flag === flag);
		if (!flagToCopy) {
			console.error(`Couldn't find the flag "${flag}" to copy.`);
			return;
		}
		const flagJsonString = beautify({ [flagToCopy.flag]: flagToCopy.value }, null, 1, 100);
		try {
			await clipboard.writeText(flagJsonString);
		} catch (err) {
			console.error("Couldn't write to clipboard:", err);
		}
		toast.success('Flag copied to clipboard', { duration: 750 });
	}

	let showAlertReplace: boolean = false;
	let willBeReplacedFlags: string[] = [];
	let newEditorFlags: EditorFlag[] = [];

	let openImportFlagsDialog = false;
	let importFlagsDialogValue: string;
	function showImportFlagsDialog() {
		openImportFlagsDialog = true;
	}

	async function importFlags(flagsString: string): Promise<void> {
		let flagsJson: Record<string, FastFlag> = {};
		flagsJson = correctAndParseJSON(flagsString, { friendly: true }); // Throws error if invalid

		newEditorFlags = [];
		for (const [flag, value] of Object.entries(flagsJson)) {
			newEditorFlags.push({ flag, value, enabled: true });
		}
		const flagNames: string[] = newEditorFlags.map((flag) => flag.flag);
		willBeReplacedFlags = flags.map((flag) => flag.flag).filter((flag) => flagNames.includes(flag));
		if (willBeReplacedFlags.length > 0) {
			showAlertReplace = true;
			return;
		}
		flags = [...flags, ...newEditorFlags];
		toast.success('Imported flag(s)', { duration: 1000 });
		dispatch('update', flags);
	}

	async function copyFlags(): Promise<void> {
		if (selectedFlags.size < 1) return;
		let flagsObject: Record<string, FastFlag> = {};
		for (const flagIndex of selectedFlags) {
			const flag = flags[flagIndex];
			flagsObject[flag.flag] = flag.value;
		}
		const flagsJsonString: string = beautify(flagsObject, null, 1, 100);
		try {
			await clipboard.writeText(flagsJsonString);
			toast.success('Selected flag(s) copied to clipboard!', { duration: 1000 });
		} catch (err) {
			toast.error("Couldn't copy flags to the clipboard");
			console.error("Couldn't copy flags to the clipboard:", err);
		}
	}

	function toggleSelection(index: number): void {
		if (selectedFlags.has(index)) {
			selectedFlags.delete(index);
		} else {
			selectedFlags.add(index);
		}
		selectedFlags = selectedFlags; // Trigger reactivity
	}

	function updateFlag(index: number, field: keyof EditorFlag, value: any): void {
		(flags[index][field] as any) = value;
		flags = flags; // Trigger reactivity
		dispatch('update', flags);
	}

	function toggleSelectAll(checked: boolean | null): void {
		if (checked == null) return;
		if (checked) {
			selectedFlags = new Set(filteredFlags.map((flag) => flags.indexOf(flag)));
		} else {
			selectedFlags.clear();
		}
		selectedFlags = selectedFlags; // Trigger reactivity
	}

	// Batch enable/disable functions
	function batchToggleEnabled(enableState: boolean): void {
		if (selectedFlags.size < 1) return;

		let changedCount = 0;
		for (const flagIndex of selectedFlags) {
			if (flags[flagIndex].enabled !== enableState) {
				flags[flagIndex].enabled = enableState;
				changedCount++;
			}
		}

		if (changedCount > 0) {
			flags = flags; // Trigger reactivity
			dispatch('update', flags);
			const action = enableState ? 'enabled' : 'disabled';
		}
	}

	// Get the state of selected flags for batch control
	$: selectedFlagStates = Array.from(selectedFlags)
		.map((index) => flags[index]?.enabled)
		.filter((state) => state !== undefined);
	$: allSelectedEnabled = selectedFlagStates.length > 0 && selectedFlagStates.every((state) => state === true);
	$: allSelectedDisabled = selectedFlagStates.length > 0 && selectedFlagStates.every((state) => state === false);
	$: mixedSelectedStates = selectedFlagStates.length > 0 && !allSelectedEnabled && !allSelectedDisabled;

	$: filteredFlags = flags
		.filter((flag: EditorFlag) => flag.flag.toLowerCase().includes(searchTerm.toLowerCase()))
		.sort((a: EditorFlag, b: EditorFlag) => {
			const aStartsWith = a.flag.toLowerCase().startsWith(searchTerm.toLowerCase());
			const bStartsWith = b.flag.toLowerCase().startsWith(searchTerm.toLowerCase());
			if (aStartsWith && !bStartsWith) return -1;
			if (!aStartsWith && bStartsWith) return 1;
			return a.flag.localeCompare(b.flag);
		});

	function handleRowClick(index: number, event: MouseEvent): void {
		// Ignore clicks on interactive elements
		if ((event.target as HTMLElement).closest('input, button, .lucide-ellipsis')) {
			return;
		}
		toggleSelection(index);
	}
</script>

<Card.Root class="p-4 w-[95%] mr-8">
	<div class="flex gap-2 mb-4">
		<Button on:click={addFlag} variant="outline"><Plus class="h-5 w-5 mr-2" />Add Flag</Button>
		<Button on:click={showImportFlagsDialog} variant="outline"><Braces class="h-5 w-5 mr-2" />Import</Button>
		<Button
			on:click={copyFlags}
			variant="outline"
			class={`duration-100 transition-opacity ${selectedFlags.size < 1 ? 'opacity-50 cursor-not-allowed border-none' : ''}`}
			><Clipboard class="h-5 w-5 mr-2" />Export</Button
		>
		<Button
			on:click={removeSelected}
			variant="outline"
			class={`hover:border-red-500 border-[1px] duration-100 transition ${selectedFlags.size < 1 ? 'opacity-50 cursor-not-allowed border-none' : ''}`}
			><Delete class="h-5 w-5 mr-2" />Remove Selected</Button
		>
		<div class="flex-grow"></div>
		<div class="relative">
			<Search class="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
			<Input type="text" placeholder="Search flags..." class="pl-8" bind:value={searchTerm} />
		</div>
	</div>
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-[50px]">
					<Checkbox
						checked={selectedFlags.size === filteredFlags.length && filteredFlags.length > 0}
						onCheckedChange={(checked) => toggleSelectAll(checked === 'indeterminate' ? null : checked)}
					/>
				</Table.Head>
				<Table.Head><div class="w-[100px]">Flag</div></Table.Head>
				<Table.Head>Value</Table.Head>
				<Table.Head class="w-[100px]">
					<div class="flex items-center gap-2">
						<span>Enabled</span>
						{#if selectedFlags.size > 0}
							<div class="flex items-center gap-1 ml-2">
								<Switch
									checked={allSelectedEnabled}
									onCheckedChange={(checked) => batchToggleEnabled(checked)}
									class={`scale-75 ${mixedSelectedStates ? 'opacity-60' : ''}`}
									disabled={selectedFlags.size === 0}
								/>
								<span class="text-xs text-muted-foreground">
									({selectedFlags.size})
								</span>
							</div>
						{/if}
					</div>
				</Table.Head>
				<Table.Head class="w-[50px]"></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each filteredFlags as flag, index (flag.flag)}
				<Table.Row
					class="cursor-pointer {selectedFlags.has(flags.indexOf(flag)) ? 'bg-muted' : ''}"
					on:click={(event) => handleRowClick(flags.indexOf(flag), event)}
				>
					<Table.Cell class="w-[50px]">
						<Checkbox
							checked={selectedFlags.has(flags.indexOf(flag))}
							onCheckedChange={() => toggleSelection(flags.indexOf(flag))}
						/>
					</Table.Cell>
					<Table.Cell class="min-w-64">
						<div class="flex w-full h-full justify-center text-foreground font-mono">
							<Label class="text-start w-full text-ellipsis overflow-x-hidden select-none">{flag.flag}</Label>
						</div>
					</Table.Cell>
					<Table.Cell>
						<Input
							bind:value={flag.value}
							on:input={() => updateFlag(flags.indexOf(flag), 'value', flag.value)}
							placeholder="Flag value"
							on:click={(e) => e.stopPropagation()}
						/>
					</Table.Cell>
					<Table.Cell class="w-[100px]">
						<Switch
							checked={flag.enabled}
							onCheckedChange={(checked) => updateFlag(flags.indexOf(flag), 'enabled', checked)}
							on:click={(e) => e.stopPropagation()}
						/>
					</Table.Cell>
					<Table.Cell class="w-[50px]">
						<DropdownMenu.Root>
							<DropdownMenu.Trigger><Ellipsis /></DropdownMenu.Trigger>
							<DropdownMenu.Content>
								<DropdownMenu.Item
									class="cursor-pointer"
									on:click={() => {
										showRenameFlagDialog(flag.flag);
									}}>Rename</DropdownMenu.Item
								>
								<DropdownMenu.Item
									class="cursor-pointer"
									on:click={() => {
										contextMenuCopy(flag.flag);
									}}>Copy</DropdownMenu.Item
								>
								<DropdownMenu.Item
									class="cursor-pointer text-red-500"
									on:click={() => {
										contextMenuRemove(flag.flag);
									}}>Delete</DropdownMenu.Item
								>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</Card.Root>

<Dialog.Root bind:open={showFlagDialog}>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>Add a new FastFlag</Dialog.Title>
			<Dialog.Description>Enter the value of your new flag. Click save when you're done.</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="name" class="text-right">Flag</Label>
				<Input id="name" placeholder="FFlagMySuperFlag" class="col-span-3" bind:value={flagDialogName} />
			</div>
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="username" class="text-right">Value</Label>
				<Input id="username" placeholder="true, false, null, etc..." class="col-span-3" bind:value={flagDialogValue} />
			</div>
		</div>
		<Dialog.Footer>
			<Button
				type="submit"
				on:click={() => {
					if (!isFlagNameValid(flagDialogName)) {
						toast.error('A flag cannot be null or contain special characters in its name.', { duration: 3000 });
						return;
					}
					const newFlag = {
						flag: flagDialogName.trim(),
						enabled: true,
						value: typeof flagDialogValue === 'string' ? flagDialogValue.trim() : flagDialogValue,
					};
					flags = [...flags, newFlag];
					showFlagDialog = false;
					flagDialogName = '';
					flagDialogValue = '';
					dispatch('update', flags);
				}}>Save changes</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={showAlertReplace}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
			<AlertDialog.Description>
				The following flags will be replaced by the ones you imported:
				<br />
				<div class="max-w-98 text-ellipsis overflow-scroll max-h-32">
					<b><p>{willBeReplacedFlags.join(', ')}</p></b>
				</div>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<Button
				variant="secondary"
				on:click={() => {
					flags = [...flags, ...newEditorFlags.filter((flag) => !willBeReplacedFlags.includes(flag.flag))];
					toast.success('Imported flags', { duration: 1500 });
					dispatch('update', flags);
					showAlertReplace = false;
				}}>Keep current values</Button
			>
			<AlertDialog.Action
				on:click={() => {
					flags = [...flags.filter((flag) => !willBeReplacedFlags.includes(flag.flag)), ...newEditorFlags];
					toast.success('Imported flags', { duration: 1500 });
					showAlertReplace = false;
					dispatch('update', flags);
				}}>Replace</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<Dialog.Root bind:open={openRenameFlagDialog}>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>Rename flag</Dialog.Title>
			<Dialog.Description>Choose a new name for this flag. Click save when you're done.</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="flag" class="text-right">Flag Name</Label>
				<Input id="flag" bind:value={currentFlagInput} class="col-span-3" />
			</div>
		</div>
		<Dialog.Footer>
			<Button
				type="submit"
				on:click={() => {
					contextMenuRename(toRenameFlagName, currentFlagInput);
				}}>Save changes</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={openImportFlagsDialog}>
	<Dialog.Content class="sm:max-w-[550px]">
		<Dialog.Header>
			<Dialog.Title>Import flags</Dialog.Title>
			<Dialog.Description>Paste your fast flags JSON here.</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<Textarea
				bind:value={importFlagsDialogValue}
				placeholder={'{\n   "DFFlagUseAppleBlox": true,\n   "FFlagEnableUltraBurgers": false\n}'}
				class="col-span-3 min-h-48 text-start align-top"
			/>
		</div>
		<Dialog.Footer>
			<Button
				on:click={async () => {
					const imported = await importFlags(importFlagsDialogValue || '')
						.then(() => {
							return true;
						})
						.catch((err) => {
							console.error(err);
							toast.error(err.toString());
							return false;
						});
					if (imported) {
						openImportFlagsDialog = false;
						importFlagsDialogValue = '';
					}
				}}>Import</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
