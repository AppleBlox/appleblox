<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { os, server } from '@neutralinojs/lib';
	import { Trash2, Upload, Pin } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Logger from '../../ts/utils/logger';
	import { getDataDir } from '../../ts/utils/paths';
	import { getValue, setValue } from '../settings/files';
	import { shell } from '../../ts/tools/shell';
	import * as shellfs from '../../ts/tools/shellfs';
	import { getBundledIconNames } from '../../ts/utils/bundled-icons';

	interface IconEntry {
		name: string;
		path: string;
		displayUrl: string;
		isOriginal?: boolean;
		isBundled?: boolean;
	}

	let icons: IconEntry[] = [];
	let selectedIcon: string | null = null;
	let showConfirmDialog = false;
	let pendingIcon: IconEntry | null = null;
	let iconsDir: string = '';
	let appResourcesPath: string = '';

	onMount(async () => {
		await loadIcons();
		await checkCurrentIcon();
	});

	/**
	 * Check if we're running in production (from app bundle) or dev mode
	 */
	function isProductionMode(): boolean {
		// In production, NL_PATH points to the Resources directory inside any .app bundle
		// In dev mode, NL_PATH points to the project directory
		return window.NL_PATH.includes('.app/Contents/Resources');
	}

	async function convertIconToPNG(icnsPath: string, pngPath: string): Promise<void> {
		// Convert .icns to PNG using sips at 256x256
		await shell('sips', ['-s', 'format', 'png', icnsPath, '--out', pngPath, '--resampleWidth', '256'], {
			skipStderrCheck: true,
		});
	}

	async function loadIcons() {
		try {
			// Icon customization only works in production mode (running from app bundle)
			if (!isProductionMode()) {
				Logger.info('Icon manager disabled in dev mode');
				return;
			}

			const dataDir = await getDataDir();
			iconsDir = `${dataDir}/icons`;
			// In production, NL_PATH points to the Resources directory
			appResourcesPath = window.NL_PATH;

			// Ensure icons directory exists
			await shellfs.createDirectory(iconsDir);

			// Create cache directory for PNG previews
			const cacheDir = `${dataDir}/cache/icon-previews`;
			await shellfs.createDirectory(cacheDir);

			// Create cache directory for original icon backup
			const originalIconCacheDir = `${dataDir}/cache/original-icon`;
			await shellfs.createDirectory(originalIconCacheDir);

			// Mount cache directory to serve files
			try {
				await server.mount('/icon-previews/', cacheDir);
			} catch (e) {
				Logger.warn('Icon previews directory already mounted or failed to mount:', e);
			}

			// Use window.location.origin to get the base URL with correct port
			const baseUrl = window.location.origin;

			// Paths for original icon
			const originalIconPath = `${appResourcesPath}/icon.icns`;
			const originalIconBackupPath = `${originalIconCacheDir}/original.icns`;
			const originalPngPath = `${cacheDir}/original.png`;

			// Automatically backup the original icon if not already backed up
			try {
				await shell('test', ['-f', originalIconPath], { skipStderrCheck: true });
				// Original icon exists in Resources

				// Check if we already have a backup in cache
				const backupExists = await shellfs.exists(originalIconBackupPath);
				if (!backupExists) {
					// No backup exists, create one
					await shellfs.copy(originalIconPath, originalIconBackupPath);
					Logger.info('Automatically backed up original icon to cache');
				}
			} catch (e) {
				Logger.warn('Could not backup original icon:', e);
			}

			// Load the original icon for display (from cache if it exists, otherwise from Resources)
			let originalIconDisplayPath = originalIconPath;
			try {
				const backupExists = await shellfs.exists(originalIconBackupPath);
				if (backupExists) {
					// Use the cached backup for display
					originalIconDisplayPath = originalIconBackupPath;
				}

				// Convert to PNG for preview
				await convertIconToPNG(originalIconDisplayPath, originalPngPath);
				icons = [
					{
						name: 'Default',
						path: originalIconBackupPath, // Always point to the cached backup
						displayUrl: `${baseUrl}/icon-previews/original.png?t=${Date.now()}`,
						isOriginal: true,
					},
				];
			} catch (e) {
				Logger.error('Could not load original icon:', e);
				icons = [];
			}

			// Get list of bundled icons
			const bundledIconNames = await getBundledIconNames();

			// Load custom icons from library using shell
			try {
				const result = await shell('ls', [iconsDir], { skipStderrCheck: true });
				if (result.stdOut) {
					const files = result.stdOut.trim().split('\n');
					for (const file of files) {
						if (file.endsWith('.icns') && file !== 'original_backup.icns') {
							const pngFileName = file.replace('.icns', '.png');
							const pngPath = `${cacheDir}/${pngFileName}`;

							try {
								// Convert icns to png for display
								await convertIconToPNG(`${iconsDir}/${file}`, pngPath);

								const isBundled = bundledIconNames.includes(file);

								icons.push({
									name: file.replace('.icns', ''),
									path: `${iconsDir}/${file}`,
									displayUrl: `${baseUrl}/icon-previews/${pngFileName}?t=${Date.now()}`,
									isBundled,
								});
							} catch (e) {
								Logger.warn(`Could not convert icon ${file}:`, e);
							}
						}
					}
				}
			} catch (e) {
				Logger.warn('Could not read icons directory:', e);
			}

			icons = icons;
		} catch (error) {
			Logger.error('Failed to load icons:', error);
			toast.error('Failed to load icon library');
		}
	}

	async function checkCurrentIcon() {
		try {
			const savedIcon = await getValue('appearance.icon.selected');
			if (savedIcon && typeof savedIcon === 'string') {
				selectedIcon = savedIcon;
			}
		} catch (e) {
			Logger.warn('Could not load saved icon preference:', e);
		}
	}

	async function uploadIcon() {
		try {
			const selection = await os.showOpenDialog('Select Icon File', {
				multiSelections: false,
			});

			if (!selection || selection.length === 0) return;

			const sourcePath = selection[0];

			// Validate that the file is an .icns file
			if (!sourcePath.toLowerCase().endsWith('.icns')) {
				toast.error('Please select a valid .icns file');
				return;
			}

			const fileName = sourcePath.split('/').pop() || 'custom.icns';
			const destPath = `${iconsDir}/${fileName}`;

			// Copy icon to library using shellfs
			await shellfs.copy(sourcePath, destPath);

			toast.success('Icon uploaded successfully');
			await loadIcons();
		} catch (error) {
			Logger.error('Failed to upload icon:', error);
			toast.error('Failed to upload icon');
		}
	}

	async function applyIcon(icon: IconEntry) {
		pendingIcon = icon;
		showConfirmDialog = true;
	}

	async function confirmApply() {
		if (!pendingIcon) return;

		try {
			// The original icon is already backed up automatically in loadIcons()
			// to cache/original-icon/original.icns, so we can directly apply the new icon

			// Copy selected icon to Resources
			await shellfs.copy(pendingIcon.path, `${appResourcesPath}/icon.icns`);

			// Save preference (createNew = true because 'selected' widget doesn't exist in panel definition)
			await setValue('appearance.icon.selected', pendingIcon.path, true);
			selectedIcon = pendingIcon.path;

			showConfirmDialog = false;
			pendingIcon = null;

			// Refresh macOS icon cache
			toast.success('Icon applied successfully!');
			Logger.info('Applied icon, refreshing icon cache');

			try {
				// Force macOS to refresh icon cache for the app bundle
				// Touch the app bundle to invalidate the icon cache
				const appBundlePath = window.NL_PATH.replace('/Contents/Resources', '');
				await shell('touch', [appBundlePath], { skipStderrCheck: true });

				// Clear Launch Services database for this app
				await shell('killall', ['Dock'], { skipStderrCheck: true });

				Logger.info('Icon cache refreshed');
			} catch (error) {
				Logger.warn('Failed to refresh icon cache:', error);
			}
		} catch (error) {
			Logger.error('Failed to apply icon:', error);
			toast.error('Failed to apply icon. Make sure AppleBlox has write permissions.');
		}
	}

	async function deleteIcon(icon: IconEntry, event: Event) {
		event.stopPropagation();

		// Don't allow deleting the original icon
		if (icon.isOriginal) return;

		try {
			// Delete the .icns file
			await shellfs.remove(icon.path);

			// If this was the selected icon, clear the selection and restore original
			if (selectedIcon === icon.path) {
				const dataDir = await getDataDir();
				const originalIconCacheDir = `${dataDir}/cache/original-icon`;
				const backupPath = `${originalIconCacheDir}/original.icns`;

				try {
					const backupExists = await shellfs.exists(backupPath);
					if (backupExists) {
						await shellfs.copy(backupPath, `${appResourcesPath}/icon.icns`);
						Logger.info('Restored original icon from cache');
					} else {
						Logger.warn('No original icon backup found in cache');
						toast.error('Could not restore original icon - backup not found');
					}
				} catch (error) {
					Logger.error('Failed to restore original icon:', error);
					toast.error('Failed to restore original icon');
				}
				await setValue('appearance.icon.selected', null, true);
				selectedIcon = null;
			}

			toast.success('Icon deleted successfully');
			await loadIcons();
		} catch (error) {
			Logger.error('Failed to delete icon:', error);
			toast.error('Failed to delete icon');
		}
	}

	// Mouse tracking for 3D effect
	function handleMouseMove(event: MouseEvent) {
		const card = event.currentTarget as HTMLElement;
		const rect = card.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const centerX = rect.width / 2;
		const centerY = rect.height / 2;

		const rotateX = ((y - centerY) / centerY) * -10;
		const rotateY = ((x - centerX) / centerX) * 10;

		card.style.setProperty('--rotate-x', `${rotateX}deg`);
		card.style.setProperty('--rotate-y', `${rotateY}deg`);
	}

	function handleMouseLeave(event: MouseEvent) {
		const card = event.currentTarget as HTMLElement;
		card.style.setProperty('--rotate-x', '0deg');
		card.style.setProperty('--rotate-y', '0deg');
	}

	function handleKeyDown(event: KeyboardEvent, icon: IconEntry) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			applyIcon(icon);
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-semibold">App Icon Library</h3>
			<p class="text-sm text-muted-foreground">Customize your AppleBlox app icon</p>
		</div>
		<Button variant="outline" size="sm" on:click={uploadIcon} disabled={!isProductionMode()}>
			<Upload class="mr-2 h-4 w-4" />
			Upload Icon
		</Button>
	</div>

	{#if !isProductionMode()}
		<Alert>
			<AlertDescription>
				<strong>Dev Mode:</strong> Icon customization is only available when running AppleBlox from the built app bundle.
				To use this feature, build the app with <code>bun run build</code> and run the built application.
			</AlertDescription>
		</Alert>
	{:else}
		<div class="grid grid-cols-3 gap-6 sm:grid-cols-4 md:grid-cols-5">
			{#each icons as icon}
				<div
					class="icon-card {selectedIcon === icon.path ? 'selected' : ''}"
					on:click={() => applyIcon(icon)}
					on:keydown={(e) => handleKeyDown(e, icon)}
					on:mousemove={handleMouseMove}
					on:mouseleave={handleMouseLeave}
					role="button"
					tabindex="0"
				>
					<div class="icon-wrapper">
						<img src={icon.displayUrl} alt={icon.name} class="icon-image" />
						{#if !icon.isOriginal && !icon.isBundled}
							<button
								class="delete-button"
								on:click={(e) => deleteIcon(icon, e)}
								aria-label="Delete icon"
								title="Delete icon"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						{:else if icon.isBundled}
							<div class="pin-indicator" title="Bundled icon">
								<Pin class="h-4 w-4" />
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<Dialog bind:open={showConfirmDialog}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Apply Custom Icon?</DialogTitle>
			<DialogDescription>
				This will replace the current app icon. You can restore the original icon at any time.
			</DialogDescription>
		</DialogHeader>
		<div class="flex justify-end gap-2">
			<Button variant="outline" on:click={() => (showConfirmDialog = false)}>Cancel</Button>
			<Button on:click={confirmApply}>Apply Icon</Button>
		</div>
	</DialogContent>
</Dialog>

<style>
	.icon-card {
		--rotate-x: 0deg;
		--rotate-y: 0deg;
		cursor: pointer;
		transition: transform 0.15s ease-out;
		transform: perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y));
	}

	.icon-card:hover {
		transform: perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y)) scale(1.05);
	}

	.icon-wrapper {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 1rem;
		overflow: hidden;
		background: hsl(var(--muted));
		box-shadow:
			0 10px 30px -5px rgba(0, 0, 0, 0.3),
			0 5px 15px -3px rgba(0, 0, 0, 0.2);
		transition: box-shadow 0.3s ease;
	}

	.icon-card:hover .icon-wrapper {
		box-shadow:
			0 20px 40px -5px rgba(0, 0, 0, 0.4),
			0 10px 25px -3px rgba(0, 0, 0, 0.3);
	}

	.icon-card.selected .icon-wrapper {
		box-shadow:
			0 0 0 3px hsl(var(--primary)),
			0 20px 40px -5px rgba(0, 0, 0, 0.4),
			0 10px 25px -3px rgba(0, 0, 0, 0.3);
	}

	.icon-image {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		padding: 0.75rem;
	}

	.delete-button {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background: hsl(var(--destructive));
		color: hsl(var(--destructive-foreground));
		border: none;
		border-radius: 0.375rem;
		padding: 0.5rem;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
	}

	.icon-card:hover .delete-button {
		opacity: 1;
	}

	.delete-button:hover {
		background: hsl(var(--destructive) / 0.9);
	}

	.pin-indicator {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border-radius: 0.375rem;
		padding: 0.5rem;
		opacity: 0;
		transition: opacity 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
	}

	.icon-card:hover .pin-indicator {
		opacity: 1;
	}
</style>
