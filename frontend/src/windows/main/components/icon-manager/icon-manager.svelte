<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { os, server, MessageBoxChoice } from '@neutralinojs/lib';
	import { RefreshCw, Upload } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Logger from '../../ts/utils/logger';
	import { getDataDir } from '../../ts/utils/paths';
	import { getValue, setValue } from '../settings/files';
	import { shell } from '../../ts/tools/shell';
	import * as shellfs from '../../ts/tools/shellfs';

	interface IconEntry {
		name: string;
		path: string;
		displayUrl: string;
		isOriginal?: boolean;
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

	async function convertIconToPNG(icnsPath: string, pngPath: string): Promise<void> {
		// Convert .icns to PNG using sips at 256x256
		await shell('sips', ['-s', 'format', 'png', icnsPath, '--out', pngPath, '--resampleWidth', '256'], {
			skipStderrCheck: true,
		});
	}

	async function loadIcons() {
		try {
			const dataDir = await getDataDir();
			iconsDir = `${dataDir}/icons`;
			// window.NL_PATH already points to Resources directory
			appResourcesPath = window.NL_PATH;

			// Ensure icons directory exists
			await shellfs.createDirectory(iconsDir);

			// Create cache directory for PNG previews
			const cacheDir = `${dataDir}/cache/icon-previews`;
			await shellfs.createDirectory(cacheDir);

			// Mount cache directory to serve files
			try {
				await server.mount(cacheDir, '/icon-previews/');
			} catch (e) {
				Logger.warn('Icon previews directory already mounted or failed to mount:', e);
			}

			// Use window.location.origin to get the base URL with correct port
			const baseUrl = window.location.origin;

			// Convert and add original icon
			const originalPngPath = `${cacheDir}/original.png`;
			try {
				await convertIconToPNG(`${appResourcesPath}/icon.icns`, originalPngPath);
				icons = [
					{
						name: 'AppleBlox Original',
						path: `${appResourcesPath}/icon.icns`,
						displayUrl: `${baseUrl}/icon-previews/original.png`,
						isOriginal: true,
					},
				];
			} catch (e) {
				Logger.warn('Could not convert original icon:', e);
				icons = [];
			}

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

								icons.push({
									name: file.replace('.icns', ''),
									path: `${iconsDir}/${file}`,
									displayUrl: `${baseUrl}/icon-previews/${pngFileName}`,
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
				filters: [{ name: 'Icon Files', extensions: ['icns'] }],
				multiSelections: false,
			});

			if (!selection || selection.length === 0) return;

			const sourcePath = selection[0];
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
			// Backup original icon if not already backed up
			const backupPath = `${iconsDir}/original_backup.icns`;

			// Check if backup exists
			try {
				await shell('test', ['-f', backupPath], { skipStderrCheck: true });
			} catch {
				// Backup doesn't exist, create it
				await shellfs.copy(`${appResourcesPath}/icon.icns`, backupPath);
				Logger.info('Backed up original icon');
			}

			// Copy selected icon to Resources
			await shellfs.copy(pendingIcon.path, `${appResourcesPath}/icon.icns`);

			// Save preference
			await setValue('appearance.icon.selected', pendingIcon.path);
			selectedIcon = pendingIcon.path;

			toast.success('Icon applied successfully! Restart AppleBlox to see changes.');

			// Ask about enabling native dock mode
			const nativeMode = await getValue('appearance.dock.native_mode');
			if (!nativeMode) {
				setTimeout(askAboutNativeMode, 1000);
			}

			showConfirmDialog = false;
			pendingIcon = null;
		} catch (error) {
			Logger.error('Failed to apply icon:', error);
			toast.error('Failed to apply icon. Make sure AppleBlox has write permissions.');
		}
	}

	async function askAboutNativeMode() {
		const result = await os.showMessageBox(
			'Enable Native Dock Mode?',
			'Custom icons work best with Native Dock Mode enabled. This will show the bootstrap icon in the dock and hide the Neutralino window.\n\nWould you like to enable it now?',
			MessageBoxChoice.YES_NO
		);

		if (result === 'YES') {
			await setValue('appearance.dock.native_mode', true);
			await enableNativeMode();
			toast.success('Native dock mode enabled! Restart AppleBlox for changes to take effect.');
		}
	}

	async function enableNativeMode() {
		try {
			// Create bootstrap_native file
			await shellfs.writeFile(`${appResourcesPath}/bootstrap_native`, '');
			Logger.info('Enabled native dock mode');
		} catch (error) {
			Logger.error('Failed to enable native dock mode:', error);
			toast.error('Failed to enable native dock mode');
		}
	}

	async function restoreOriginal() {
		try {
			const backupPath = `${iconsDir}/original_backup.icns`;

			// Check if backup exists
			try {
				await shell('test', ['-f', backupPath], { skipStderrCheck: true });
				// Backup exists, restore from it
				await shellfs.copy(backupPath, `${appResourcesPath}/icon.icns`);
			} catch {
				// No backup, use original from resources (which might be already modified)
				Logger.warn('No backup found, icon may already be original');
			}

			await setValue('appearance.icon.selected', null);
			selectedIcon = null;

			toast.success('Original icon restored! Restart AppleBlox to see changes.');
		} catch (error) {
			Logger.error('Failed to restore original icon:', error);
			toast.error('Failed to restore original icon');
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
		<div class="flex gap-2">
			<Button variant="outline" size="sm" on:click={uploadIcon}>
				<Upload class="mr-2 h-4 w-4" />
				Upload Icon
			</Button>
			<Button variant="outline" size="sm" on:click={restoreOriginal}>
				<RefreshCw class="mr-2 h-4 w-4" />
				Restore Original
			</Button>
		</div>
	</div>

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
				</div>
			</div>
		{/each}
	</div>

	<Alert>
		<AlertDescription>
			<strong>Note:</strong> Custom icons work best with Native Dock Mode enabled. This allows support for liquid glass icons,
			custom shapes, and better macOS integration. Enable it in the "Dock & Window" section above.
		</AlertDescription>
	</Alert>
</div>

<Dialog bind:open={showConfirmDialog}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Apply Custom Icon?</DialogTitle>
			<DialogDescription>
				This will replace the current app icon. You can restore the original icon at any time. AppleBlox needs to be
				restarted for changes to take effect.
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
		object-fit: cover;
		display: block;
	}
</style>
