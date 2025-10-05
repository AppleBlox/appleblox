<script lang="ts">
	import * as Alert from '$lib/components/ui/alert/index';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card/index';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import Switch from '$lib/components/ui/switch/switch.svelte';
	import SillyCat from '@/assets/panel/silly.webp';
	import { FolderOpen, RefreshCcw } from 'lucide-svelte';
	import path from 'path-browserify';
	import { toast } from 'svelte-sonner';
	import { fade } from 'svelte/transition';
	import { getConfigPath } from './settings';
	import Roblox from '../ts/roblox';
	import shellFS from '../ts/tools/shellfs';
	import { sleep } from '../ts/utils';

	let mods: { filename: string; path: string; state: boolean }[] = [];
	Roblox.Mods.loadMods().then((m) => (mods = m));

	async function onSwitchClick(filePath: string) {
		try {
			const modIndex = mods.findIndex((m) => m.path === filePath);
			if (path.basename(filePath).endsWith('.disabled')) {
				await shellFS.move(filePath, filePath.replace(/\.disabled$/, ''));
				if (modIndex >= 0) {
					mods[modIndex] = {
						...mods[modIndex],
						state: true,
						path: filePath.replace(/\.disabled$/, ''),
					};
				}
			} else {
				await shellFS.move(filePath, `${filePath}.disabled`);
				if (modIndex >= 0) {
					mods[modIndex] = {
						...mods[modIndex],
						state: false,
						path: `${filePath}.disabled`,
					};
				}
			}
		} catch (err) {
			toast.error(`An error occured while enabling/disabling mod: ${err}`);
			console.error('[Panel.ModsUI] ', err);
		}
	}

	let refreshSpin = false;
</script>

<Card.Root class="w-full bg-background">
	<Card.Header>
		<div class="flex">
			<div>
				<Card.Title class="text-primary">Mods Manager</Card.Title>
				<Card.Description
					>Enable or disable certain mods. They are loaded in alphanumerical order (1,2,3,a,b,c)</Card.Description
				>
			</div>
			<Button
				variant="outline"
				class="mr-3"
				on:click={async () => {
					try {
						const folderPath = path.join(path.dirname(await getConfigPath()), 'mods');
						await shellFS.createDirectory(folderPath);
						await sleep(10);
						await shellFS.open(folderPath);
					} catch (err) {
						toast.error(`An error occured: ${err}`);
						console.error('[ModsPanel]', err);
					}
				}}><FolderOpen class="mr-3" />Open folder</Button
			>
			<Button
				class="ml-auto mb-3 w-10 p-0"
				variant="default"
				on:click={() => {
					refreshSpin = true;
					setTimeout(() => {
						refreshSpin = false;
					}, 500);
					Roblox.Mods.loadMods().then((m) => {
						mods = m;
					});
				}}
			>
				<RefreshCcw class={`text-primary-foreground w-[50%] ${refreshSpin ? 'animate-spin' : ''}`} />
			</Button>
		</div>

		{#if mods.length > 0}
			{#each mods as mod (mod.filename)}
				<Separator class="" />
				<div class="flex items-center" transition:fade={{ duration: 100 }}>
					<div>
						<p class="font-semibold text-[#0a0808] dark:text-red-100 text-2xl my-1">{mod.filename}</p>
					</div>
					<Switch
						checked={mod.state}
						class="ml-auto mr-4"
						on:click={() => {
							onSwitchClick(mod.path);
						}}
					/>
				</div>
			{/each}
		{:else}
			<div class="flex flex-col justify-center items-center gap-3">
				<Alert.Root>
					<Alert.Title>No mods found</Alert.Title>
					<Alert.Description class="flex gap-3 items-center justify-start"
						><p>You haven't downloaded any mods.</p>
						<img src={SillyCat} alt="No mods found icnon" class="w-16 h-10 rounded-sm" /></Alert.Description
					>
				</Alert.Root>
			</div>
		{/if}
	</Card.Header>
</Card.Root>
