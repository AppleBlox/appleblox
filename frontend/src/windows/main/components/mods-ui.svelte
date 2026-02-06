<script lang="ts">
	import * as Alert from '$lib/components/ui/alert/index';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge';
	import Switch from '$lib/components/ui/switch/switch.svelte';
	import SillyCat from '@/assets/panel/silly.webp';
	import { FolderOpen, RefreshCcw, FileImage } from 'lucide-svelte';
	import path from 'path-browserify';
	import { toast } from 'svelte-sonner';
	import { fade } from 'svelte/transition';
	import Roblox from '../ts/roblox';
	import shellFS from '../ts/tools/shellfs';
	import { sleep } from '../ts/utils';
	import { getConfigPath } from './settings';
	import Logger from '@/windows/main/ts/utils/logger';
	import { filesystem, server } from '@neutralinojs/lib';
	import { shell } from '../ts/tools/shell';
	import { getDataDir } from '../ts/utils/paths';

	interface ModInfo {
		filename: string;
		path: string;
		state: boolean;
		assetCount?: number;
		sizeMB?: number;
		previewImages?: string[];
		previewUrls?: string[];
	}

	let mods: ModInfo[] = [];
	let refreshSpin = false;
	let modPreviewsMounted = false;

	async function loadModsWithDetails() {
		const baseMods = await Roblox.Mods.loadMods();
		const detailedMods: ModInfo[] = [];

		const dataDir = await getDataDir();
		const cacheDir = `${dataDir}/cache/mod-previews`;
		await shellFS.createDirectory(cacheDir);

		if (!modPreviewsMounted) {
			try {
				await server.mount('/mod-previews/', cacheDir);
				modPreviewsMounted = true;
				await sleep(100);
			} catch (e) {
				if ((e as any)?.code === 'NE_SR_MPINUSE') {
					modPreviewsMounted = true;
				} else {
					Logger.warn('Failed to mount mod previews directory:', e);
				}
			}
		}

		for (const mod of baseMods) {
			const modInfo: ModInfo = { ...mod };

			try {
				// Get asset count
				const result = await shell('find', [mod.path, '-type', 'f'], { skipStderrCheck: true });
				const files = result.stdOut
					.trim()
					.split('\n')
					.filter((f) => f && !f.includes('.DS_Store'));
				modInfo.assetCount = files.length;

				// Get folder size in MB
				const sizeResult = await shell('du', ['-sm', mod.path], { skipStderrCheck: true });
				const sizeMB = parseInt(sizeResult.stdOut.trim().split('\t')[0]);
				modInfo.sizeMB = sizeMB;

				// Get preview images (first 3 image files)
				const imageFiles = files.filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f)).slice(0, 3);
				modInfo.previewImages = imageFiles;

				// Copy preview images to cache and generate URLs
				const previewUrls: string[] = [];
				// Sanitize mod filename to only contain A-Z, 0-9, and underscores
				const sanitizedModName = mod.filename.replace(/[^a-zA-Z0-9_]/g, '_');
				for (let i = 0; i < imageFiles.length; i++) {
					const imgPath = imageFiles[i];
					const fileName = `${sanitizedModName}_preview_${i}${path.extname(imgPath)}`;
					const cachedPath = `${cacheDir}/${fileName}`;

					try {
						// Copy image to cache
						await shellFS.copy(imgPath, cachedPath);
						// Generate relative URL (no encoding needed with sanitized filename)
						const url = `/mod-previews/${fileName}?t=${Date.now()}`;
						previewUrls.push(url);
					} catch (e) {
						Logger.warn(`Could not cache preview image ${imgPath}:`, e);
					}
				}
				modInfo.previewUrls = previewUrls;
			} catch (e) {
				Logger.warn(`Could not get details for mod ${mod.filename}:`, e);
				modInfo.assetCount = 0;
				modInfo.sizeMB = 0;
				modInfo.previewImages = [];
				modInfo.previewUrls = [];
			}

			detailedMods.push(modInfo);
		}

		return detailedMods;
	}

	loadModsWithDetails().then((m) => (mods = m));

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
			Logger.withContext('mods-ui').error(err);
		}
	}

	function handleMouseMove(event: MouseEvent) {
		const card = event.currentTarget as HTMLElement;
		const rect = card.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const centerX = rect.width / 2;
		const centerY = rect.height / 2;

		const rotateX = ((y - centerY) / centerY) * -5;
		const rotateY = ((x - centerX) / centerX) * 5;

		card.style.setProperty('--rotate-x', `${rotateX}deg`);
		card.style.setProperty('--rotate-y', `${rotateY}deg`);
	}

	function handleMouseLeave(event: MouseEvent) {
		const card = event.currentTarget as HTMLElement;
		card.style.setProperty('--rotate-x', '0deg');
		card.style.setProperty('--rotate-y', '0deg');
	}

	function handleImageError(event: Event) {
		const target = event.currentTarget as HTMLImageElement;
		target.style.display = 'none';
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<h3 class="text-2xl font-bold text-foreground">Mods Manager</h3>
			<p class="text-sm text-muted-foreground">Manage your Roblox modifications</p>
		</div>
		<div class="flex gap-2">
			<Button
				variant="outline"
				size="sm"
				on:click={async () => {
					try {
						const folderPath = path.join(path.dirname(await getConfigPath()), 'mods');
						await shellFS.createDirectory(folderPath);
						await sleep(10);
						await shellFS.open(folderPath);
					} catch (err) {
						toast.error(`An error occured: ${err}`);
						Logger.withContext('mods-panel').error(err);
					}
				}}
			>
				<FolderOpen class="h-4 w-4 mr-2" />
				Open Folder
			</Button>
			<Button
				variant="outline"
				size="sm"
				on:click={() => {
					refreshSpin = true;
					setTimeout(() => {
						refreshSpin = false;
					}, 500);
					loadModsWithDetails().then((m) => {
						mods = m;
					});
				}}
			>
				<RefreshCcw class={`h-4 w-4 ${refreshSpin ? 'animate-spin' : ''}`} />
			</Button>
		</div>
	</div>

	{#if mods.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each mods as mod (mod.filename)}
				<div
					class="mod-card"
					on:mousemove={handleMouseMove}
					on:mouseleave={handleMouseLeave}
					transition:fade={{ duration: 150 }}
					role="group"
					aria-label="Mod {mod.filename}"
				>
					<Card.Root class="mod-card-wrapper h-full border overflow-hidden">
						<Card.Content class="p-0 h-full flex flex-col">
							<!-- Preview Section -->
							<div class="preview-container relative w-full h-48 bg-muted/30 overflow-hidden">
								{#if mod.previewUrls && mod.previewUrls.length > 0}
									<div class="stacked-previews">
										{#each mod.previewUrls.slice(0, 3) as imgUrl, index}
											<div
												class="preview-image"
												style="
													--offset: {index};
													z-index: {3 - index};
													transform: translate({index * 8}px, {index * 8}px) rotate({index * 2}deg);
												"
											>
												<img
													src={imgUrl}
													alt="Preview {index + 1}"
													class="w-full h-full object-cover"
													on:error={handleImageError}
												/>
											</div>
										{/each}
									</div>
								{:else}
									<div class="flex items-center justify-center h-full">
										<FileImage class="h-16 w-16 text-muted-foreground/30" />
									</div>
								{/if}
							</div>

							<!-- Info Section -->
							<div class="p-4 flex-1 flex flex-col">
								<div class="flex items-start justify-between mb-2">
									<h3 class="font-bold text-foreground text-lg truncate flex-1">
										{mod.filename}
									</h3>
									<Switch
										checked={mod.state}
										on:click={() => {
											onSwitchClick(mod.path);
										}}
									/>
								</div>

								<!-- Statistics -->
								<div class="flex gap-2 mt-auto">
									<Badge variant="secondary" class="text-xs">
										{mod.assetCount || 0}
										{mod.assetCount === 1 ? 'asset' : 'assets'}
									</Badge>
									<Badge variant="secondary" class="text-xs">
										{mod.sizeMB || 0} MB
									</Badge>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				</div>
			{/each}
		</div>
	{:else}
		<div class="flex flex-col justify-center items-center gap-3 py-12">
			<Alert.Root>
				<Alert.Title>No mods found</Alert.Title>
				<Alert.Description class="flex gap-3 items-center justify-start">
					<p>You haven't downloaded any mods.</p>
					<img src={SillyCat} alt="No mods found" class="w-16 h-10 rounded-sm" />
				</Alert.Description>
			</Alert.Root>
		</div>
	{/if}
</div>

<style>
	.mod-card {
		--rotate-x: 0deg;
		--rotate-y: 0deg;
		transition: transform 0.2s ease-out;
		transform: perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y));
	}

	.mod-card:hover {
		transform: perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y)) scale(1.02);
	}

	.mod-card :global(.mod-card-wrapper) {
		background: hsl(var(--card));
		border-radius: 1rem;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		transition: box-shadow 0.3s ease;
		position: relative;
		isolation: isolate;
	}

	.mod-card:hover :global(.mod-card-wrapper) {
		box-shadow:
			0 20px 40px -5px rgba(0, 0, 0, 0.4),
			0 10px 25px -3px rgba(0, 0, 0, 0.3);
	}

	.preview-container {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.stacked-previews {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.preview-image {
		position: absolute;
		width: 70%;
		height: 70%;
		background: white;
		border-radius: 0.5rem;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.2),
			0 2px 4px -1px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		transition: transform 0.3s ease;
	}

	.mod-card:hover .preview-image {
		transform: translate(calc(var(--offset) * 12px), calc(var(--offset) * 12px)) rotate(calc(var(--offset) * 3deg)) !important;
	}
</style>
