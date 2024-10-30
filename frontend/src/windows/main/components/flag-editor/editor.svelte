<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { cn } from '$lib/utils';
	import SillyCat from '@/assets/panel/silly.webp';
	import { events, filesystem, os } from '@neutralinojs/lib';
	import type { Selected } from 'bits-ui';
	import { Gamepad2, Import, Plus, Trash2, TriangleAlert, Upload } from 'lucide-svelte';
	import path from 'path-browserify';
	import { toast } from 'svelte-sonner';
	import {
		createProfile,
		deleteProfile,
		getAllProfiles,
		getSelectedProfile,
		setSelectedProfile,
		stringToId,
		writeProfile,
		type Profile,
	} from '.';
	import { formatConsoleLog } from '../../ts/debugging';
	import shellFS from '../../ts/tools/shellfs';
	import Combox from '../combox.svelte';
	import LoadingSpinner from '../loading-spinner.svelte';
	import FlagTable from './flag-table.svelte';
	import SmallButton from './small-button.svelte';

	type SelectElement = Selected<string>;

	const profileTypes: SelectElement[] = [
		{ label: 'Default', value: 'default' },
		{ label: 'Per-game(s)', value: 'game' },
	];

	let profiles: Profile[] = [];
	let profileItems: SelectElement[] = [];
	$: profileItems = profiles.map((p) => ({ label: p.name, value: p.name }));
	let currentProfile: Profile | null = null;

	let profileSelectValue: SelectElement | undefined;
	$: profileSelectValue = currentProfile?.name ? { label: currentProfile.name, value: currentProfile.name } : undefined;

	let typeSelectValue: SelectElement | undefined;
	$: typeSelectValue = currentProfile?.type
		? { label: currentProfile.type === 'default' ? 'Default' : 'Per-game(s)', value: currentProfile.type }
		: undefined;

	let gameIds: string[] = [];
	$: gameIds = (currentProfile?.games || []) as string[];

	let gamesDialogValue = ((currentProfile as Profile | null)?.games || []).join(', ');
	let oldGamesDialogValue = gamesDialogValue;

	async function loadProfiles() {
		profiles = await getAllProfiles();
		const profile = await getSelectedProfile(profiles);
		currentProfile = profile;
		gameIds = currentProfile?.games || [];
		gamesDialogValue = ((currentProfile as Profile | null)?.games || []).join(', ');
	}

	let addProfileValue = '';
	async function addProfile() {
		const name = addProfileValue.trim();
		if (name.length < 1) {
			toast.error("Profile name can't be blank.");
			return;
		}
		const data: Profile = { name, flags: [], type: 'default', games: [] };
		const created = await createProfile(data);
		if (created) {
			profiles.push(data);
			profiles = profiles;
			currentProfile = data;
		} else {
			toast.error('A profile with the same name already exists!', { duration: 5000 });
		}
	}

	async function onProfileSelectChange(selected: SelectElement | undefined) {
		const profile = profiles.find((p) => p.name === selected?.value);
		if (!profile) return;
		await setSelectedProfile(profile.name);
		currentProfile = profile;
		gamesDialogValue = currentProfile?.games?.join(', ').trim() || '';
		oldGamesDialogValue = gamesDialogValue;
		gameIds = profile.games || [];
	}

	async function onTypeSelectChange(selected: SelectElement | undefined) {
		if (!currentProfile || !selected) return;
		const type = selected.value as 'default' | 'game';
		await writeProfile(currentProfile.name, { type, games: type === 'game' ? gameIds : undefined });
		currentProfile.type = type;
		if (type === 'default') {
			gameIds = [];
		}
	}

	async function exportProfile() {
		if (!currentProfile) {
			toast.error('No profile is selected');
			return;
		}
		const folderPath = await os.showFolderDialog('Choose a location where the file will be exported', {
			defaultPath: await os.getPath('downloads'),
		});
		if (!folderPath) return;
		const savePath = path.join(folderPath, `${stringToId(currentProfile.name)}.json`);
		try {
			await filesystem.writeFile(savePath, JSON.stringify(currentProfile));
			shellFS.open(savePath, { reveal: true });
			toast.success(`Exported to "${savePath}"`);
		} catch (err) {
			console.error("[FastFlags] Couldn't export profile:", err);
			toast.error(formatConsoleLog("[FastFlags] Couldn't export profile:", err));
		}
	}

	async function importProfile() {
		const filePath = (
			await os.showOpenDialog('Choose a valid profile.json file', {
				defaultPath: await os.getPath('downloads'),
				multiSelections: false,
			})
		)[0];
		if (!filePath) return;
		try {
			const data: Profile = JSON.parse(await filesystem.readFile(filePath));
			const created = await createProfile(data);
			if (!created) {
				toast.error('A profile with this name already exists');
				return;
			}
			currentProfile = data;
			profiles.push(data);
			profiles = profiles;
			gameIds = data.games || [];
			((currentProfile as Profile | null)?.games || []).join(', ');
		} catch (err) {
			console.error("Couldn't import profile:", err);
			toast.error("Couldn't import profile");
		}
	}

	let showAlertDialog = false;
	async function showDeletePopup() {
		showAlertDialog = true;
	}

	async function removeProfile() {
		showAlertDialog = false;
		if (!currentProfile) return;
		let currentName = currentProfile.name;
		await deleteProfile(currentName);
		profiles = profiles.filter((p) => p.name !== currentName);
		currentProfile = null;
	}

	let showGamesDialog = false;
	function openGamesDialog() {
		if (!currentProfile) return;
		showGamesDialog = true;
	}

	async function onTextAreaChange(e: Event) {
		const inputValue = (e.target as HTMLTextAreaElement).value;
		if (!/^[0-9, ]*$/.test(inputValue)) {
			toast.error('Can only contain numbers, spaces, or colons.');
			gamesDialogValue = oldGamesDialogValue;
			return;
		}
		oldGamesDialogValue = inputValue;

		// Split the input by commas and trim each part to get individual game IDs
		const newGameIds = inputValue
			.split(',')
			.map((id) => id.trim())
			.filter((id) => id !== '');

		if (currentProfile) {
			// Ensure no duplicates in game IDs
			currentProfile.games = [...new Set(newGameIds)];
			gamesDialogValue = currentProfile.games.join(', ');
			await writeProfile(currentProfile.name, { games: currentProfile.games });
		}
	}

	function flagsUpdated(e: CustomEvent) {
		if (!currentProfile) return;
		const flags = e.detail;
		currentProfile.flags = flags;
		writeProfile(currentProfile.name, { flags });
	}
</script>

<div class="flex flex-col min-h-48">
	<Breadcrumb.Root>
		<Breadcrumb.List>
			<Breadcrumb.Item>
				<a
					href="_blank"
					on:click={() => {
						events.dispatch('ui:change_page', { id: 'fastflags' });
					}}
				>
					Fast Flags
				</a>
			</Breadcrumb.Item>
			<Breadcrumb.Separator />
			<Breadcrumb.Item>
				<Breadcrumb.Page>Editor</Breadcrumb.Page>
			</Breadcrumb.Item>
		</Breadcrumb.List>
	</Breadcrumb.Root>
	<Alert.Root variant="warning" class="mt-4">
		<TriangleAlert class="h-5 w-5" />
		<Alert.Title class="ml-2">Be careful</Alert.Title>
		<Alert.Description class="ml-2"
			>FastFlags are normally used by Roblox engineers. Don't paste anything you don't understand!</Alert.Description
		>
	</Alert.Root>

	<div class="flex items-center justify-center mt-5">
		<div class="flex justify-center items-center">
			<Label for="profile" class="mr-10 text-foreground">Profile</Label>
			<Combox
				class="w-[270px]"
				popoverClass="w-[270px]"
				bind:items={profileItems}
				name="profile"
				placeholder="Search for a profile"
				bind:selected={profileSelectValue}
				on:select={(e) => {
					onProfileSelectChange(e.detail);
				}}
			/>
			<Dialog.Root>
				<Dialog.Trigger let:builder asChild>
					<SmallButton builders={[builder]} tooltip="Create a new profile" class="p-3 ml-2"><Plus /></SmallButton>
				</Dialog.Trigger>
				<Dialog.Content class="sm:max-w-[425px]">
					<Dialog.Header>
						<Dialog.Title>Add profile</Dialog.Title>
						<Dialog.Description>Create a new Flags profile. Click save when you're done.</Dialog.Description>
					</Dialog.Header>
					<div class="grid gap-4 py-4">
						<div class="grid grid-cols-4 items-center gap-4">
							<Label for="name" class="text-right">Name</Label>
							<Input id="name" placeholder="kitty :3" class="col-span-3" bind:value={addProfileValue} />
						</div>
					</div>
					<Dialog.Footer>
						<Dialog.Close>
							<Button
								type="submit"
								on:click={() => {
									addProfile();
								}}>Save changes</Button
							>
						</Dialog.Close>
					</Dialog.Footer>
				</Dialog.Content>
			</Dialog.Root>
		</div>
		{#if currentProfile}
			<div class="ml-5 flex justify-center items-center">
				<Label for="profile" class="mr-10 text-foreground">Type</Label>
				<Select.Root onSelectedChange={onTypeSelectChange} bind:selected={typeSelectValue}>
					<Select.Trigger class={cn('w-[200px]', currentProfile.type === 'game' && 'w-[152px]')}>
						<Select.Value placeholder="Select a type" />
					</Select.Trigger>
					<Select.Content>
						{#each profileTypes as type}
							<Select.Item value={type.value} label={type.label}>{type.label}</Select.Item>
						{/each}
					</Select.Content>
					<Select.Input name="favoriteFruit" />
				</Select.Root>
				{#if currentProfile.type === 'game'}
					<SmallButton tooltip="Add games" class="ml-2" on:click={openGamesDialog}><Gamepad2 /></SmallButton>
				{/if}
			</div>
		{/if}
		<div class="flex justify-center items-center">
			<Separator orientation="vertical" class="mx-3 h-10" />
			<SmallButton tooltip="Export profile" class="mr-2" on:click={exportProfile}><Upload /></SmallButton>
			<SmallButton tooltip="Import a profile" class="mr-2" on:click={importProfile}><Import /></SmallButton>
			<SmallButton tooltip="Delete profile" class="mr-2" on:click={showDeletePopup}><Trash2 /></SmallButton>
		</div>
	</div>
	<div class="w-full flex flex-col items-center justify-center mt-10">
		{#await loadProfiles()}
			<LoadingSpinner class="w-20 h-20" />
			<h2>Loading profile...</h2>
		{:then}
			{#if currentProfile}
				<FlagTable flags={currentProfile.flags} on:update={flagsUpdated} />
			{:else}
				<h2><b>¯\_(ツ)_/¯</b></h2>
				<h3>No profile selected</h3>
			{/if}
		{:catch error}
			<img src={SillyCat} alt="silly cat nono" class="rounded-sm h-20" />
			<h2 class="text-red-500">An error happened while loading profiles</h2>
			<h2 class="text-red-400">{formatConsoleLog(error)}</h2>
		{/await}
	</div>
</div>
<AlertDialog.Root bind:open={showAlertDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete your profile.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={removeProfile}>Continue</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<Dialog.Root bind:open={showGamesDialog}>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>Edit games</Dialog.Title>
			<Dialog.Description>A list of game IDs separated by colons.</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<Textarea
				placeholder="12345, 67890, 12345"
				class="min-w-[90%]"
				bind:value={gamesDialogValue}
				on:change={onTextAreaChange}
			/>
		</div>
		<Dialog.Footer>
			<Dialog.Close><Button type="submit">Submit</Button></Dialog.Close>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
