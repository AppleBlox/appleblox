<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { PathManager } from '@/windows/main/ts/roblox/path-manager';
	import { validateRobloxPath } from '@/windows/main/ts/roblox/path';
	import { os } from '@neutralinojs/lib';
	import { CheckCircle2, FolderOpen, RefreshCw, XCircle } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import RobloxDownloadButton from './roblox-download-button.svelte';

	let currentPath: string | null = null;
	let isCustom: boolean = false;
	let isValid: boolean = false;
	let isDetecting: boolean = false;

	// Load current state on mount
	onMount(async () => {
		await refreshStatus();
	});

	async function refreshStatus() {
		currentPath = PathManager.getPath();
		isCustom = await PathManager.isCustomPath();
		isValid = currentPath !== null;
	}

	// Browse for Roblox.app
	async function browsePath() {
		try {
			const selected = await os.showOpenDialog('Select Roblox.app', {
				defaultPath: '/Applications',
			});

			if (!selected || selected.length === 0) return;

			const selectedPath = selected[0];

			// Validate selected path
			if (!(await validateRobloxPath(selectedPath))) {
				toast.error('Selected path is not a valid Roblox installation', {
					description: 'Please select a valid Roblox.app bundle',
					duration: 4000,
				});
				return;
			}

			// Save and update
			await PathManager.setCustomPath(selectedPath);
			await refreshStatus();
			toast.success('Roblox path updated successfully', {
				description: `Now using: ${selectedPath}`,
				duration: 3000,
			});
		} catch (err) {
			toast.error('Error setting custom path', {
				description: String(err),
				duration: 4000,
			});
		}
	}

	// Re-run auto-detection
	async function reDetect() {
		try {
			isDetecting = true;
			const detected = await PathManager.refreshPath();
			await refreshStatus();

			if (detected) {
				toast.success('Roblox found!', {
					description: `Detected at: ${detected}`,
					duration: 3000,
				});
			} else {
				toast.warning('Roblox not found', {
					description: 'Please install Roblox or browse for its location manually',
					duration: 4000,
				});
			}
		} catch (err) {
			toast.error('Error detecting Roblox', {
				description: String(err),
				duration: 4000,
			});
		} finally {
			isDetecting = false;
		}
	}

	// Clear user override
	async function clearOverride() {
		try {
			await PathManager.clearCustomPath();
			await refreshStatus();
			toast.success('Override cleared', {
				description: 'Now using automatic detection',
				duration: 3000,
			});
		} catch (err) {
			toast.error('Error clearing override', {
				description: String(err),
				duration: 4000,
			});
		}
	}
</script>

<div class="path-selector w-full">
	<!-- Header -->
	<div class="mb-4">
		<h3 class="font-bold text-foreground text-lg">Installation Path</h3>
		<p class="text-[13px] text-foreground opacity-85 mt-1">
			AppleBlox automatically searches your entire Mac for Roblox using Spotlight. You can override this by manually
			selecting a path.
		</p>
	</div>

	<!-- Path Display Card -->
	<div class="space-y-4 p-4 border rounded-lg bg-card">
		<div class="space-y-2">
			<div class="flex items-center justify-between mb-1">
				<span class="text-sm font-medium text-muted-foreground">Current Path:</span>
				{#if isValid}
					<span class="flex items-center gap-1.5 text-xs">
						<CheckCircle2 class="w-4 h-4 text-green-500" />
						<span class="text-green-500">{isCustom ? 'User-specified' : 'Auto-detected'}</span>
					</span>
				{:else}
					<span class="flex items-center gap-1.5 text-xs">
						<XCircle class="w-4 h-4 text-red-500" />
						<span class="text-red-500">Not found</span>
					</span>
				{/if}
			</div>

			<code
				class="block w-full text-sm px-3 py-2 rounded bg-muted {isValid
					? 'text-foreground'
					: 'text-muted-foreground italic'}"
			>
				{currentPath || 'Roblox installation not detected'}
			</code>
		</div>

		<!-- Action Buttons -->
		<div class="flex flex-wrap gap-2">
			<!-- Browse Button -->
			<Tooltip.Root>
				<Tooltip.Trigger>
					<Button variant="outline" size="sm" on:click={browsePath}>
						<FolderOpen class="w-4 h-4 mr-2" />
						Browse...
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content>Manually select Roblox.app location</Tooltip.Content>
			</Tooltip.Root>

			<!-- Re-detect or Clear Override -->
			{#if isCustom}
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button variant="outline" size="sm" on:click={clearOverride}>
							<XCircle class="w-4 h-4 mr-2" />
							Clear Override
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>Revert to automatic detection</Tooltip.Content>
				</Tooltip.Root>
			{:else}
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button variant="outline" size="sm" on:click={reDetect} disabled={isDetecting}>
							<RefreshCw class="w-4 h-4 mr-2 {isDetecting ? 'animate-spin' : ''}" />
							Re-detect
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>Search for Roblox again</Tooltip.Content>
				</Tooltip.Root>
			{/if}

			<!-- Download Button (only if not found) -->
			{#if !isValid}
				<RobloxDownloadButton />
			{/if}
		</div>
	</div>
</div>
