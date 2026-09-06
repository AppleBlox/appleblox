<script lang="ts">
	import * as Alert from '$lib/components/ui/alert/index';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { filesystem, server } from '@neutralinojs/lib';
	import { os } from '@neutralinojs/lib';
	import { Check, FileImage, FolderOpen, Monitor, Pencil, Plus, RefreshCcw, Trash2, X } from 'lucide-svelte';
	import path from 'path-browserify';
	import { toast } from 'svelte-sonner';
	import { fade } from 'svelte/transition';
	import { shell } from '../../ts/tools/shell';
	import shellFS from '../../ts/tools/shellfs';
	import Logger from '@/windows/main/ts/utils/logger';
	import { sleep } from '../../ts/utils';
	import { getDataDir } from '../../ts/utils/paths';

	// -------------------------------------------------------------------------
	// Types
	// -------------------------------------------------------------------------
	interface ThemeMeta {
		id: string;
		name: string;
		hasAssets: boolean;
		previewUrls?: string[];
	}

	interface ThemeIndex {
		themes: ThemeMeta[];
		activeThemeId: string | null;
	}

	// -------------------------------------------------------------------------
	// Path helpers
	// -------------------------------------------------------------------------
	const ACTIVE_XML = 'bootstrapper-theme.xml';
	const ACTIVE_ASSETS = 'bootstrapper-theme-assets';
	const THEMES_DIR = 'bootstrapper-themes';

	async function themesDir() {
		return path.join(await getDataDir(), THEMES_DIR);
	}

	async function themeDir(id: string) {
		return path.join(await themesDir(), id);
	}

	async function themeXmlPath(id: string) {
		return path.join(await themeDir(id), 'Theme.xml');
	}

	async function activeXmlPath() {
		return path.join(await getDataDir(), ACTIVE_XML);
	}

	async function activeAssetsPath() {
		return path.join(await getDataDir(), ACTIVE_ASSETS);
	}

	// -------------------------------------------------------------------------
	// Index persistence
	// -------------------------------------------------------------------------
	async function loadIndex(): Promise<ThemeIndex> {
		const idxPath = path.join(await themesDir(), 'index.json');
		if (!(await shellFS.exists(idxPath))) return { themes: [], activeThemeId: null };
		try {
			const content = await shellFS.readFile(idxPath);
			return JSON.parse(content) as ThemeIndex;
		} catch {
			return { themes: [], activeThemeId: null };
		}
	}

	async function saveIndex(idx: ThemeIndex): Promise<void> {
		const dir = await themesDir();
		if (!(await shellFS.exists(dir))) await shellFS.createDirectory(dir);
		const idxPath = path.join(dir, 'index.json');
		await filesystem.writeFile(idxPath, JSON.stringify(idx, null, 2));
	}

	// -------------------------------------------------------------------------
	// Preview loading
	// -------------------------------------------------------------------------
	let previewsMounted = false;

	async function loadPreviews(themes: ThemeMeta[]): Promise<ThemeMeta[]> {
		const dataDir = await getDataDir();
		const cacheDir = path.join(dataDir, 'cache', 'theme-previews');
		await shellFS.createDirectory(cacheDir);

		if (!previewsMounted) {
			try {
				await server.mount('/theme-previews/', cacheDir);
				previewsMounted = true;
				await sleep(100);
			} catch (e) {
				if ((e as any)?.code === 'NE_SR_MPINUSE') {
					previewsMounted = true;
				} else {
					Logger.warn('Failed to mount theme previews directory:', e);
				}
			}
		}

		return Promise.all(
			themes.map(async (theme) => {
				const tDir = await themeDir(theme.id);
				try {
					const result = await shell('find', [tDir, '-type', 'f'], { skipStderrCheck: true });
					const files = result.stdOut
						.trim()
						.split('\n')
						.filter((f) => f && !f.includes('.DS_Store'));
					const imageFiles = files.filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f)).slice(0, 3);

					const sanitizedId = theme.id.replace(/[^a-zA-Z0-9_]/g, '_');
					const previewUrls: string[] = [];
					for (let i = 0; i < imageFiles.length; i++) {
						const imgPath = imageFiles[i];
						const fileName = `${sanitizedId}_preview_${i}${path.extname(imgPath)}`;
						const cachedPath = path.join(cacheDir, fileName);
						try {
							await shellFS.copy(imgPath, cachedPath);
							previewUrls.push(`/theme-previews/${fileName}?t=${Date.now()}`);
						} catch (e) {
							Logger.warn(`Could not cache preview image ${imgPath}:`, e);
						}
					}
					return { ...theme, previewUrls };
				} catch {
					return { ...theme, previewUrls: [] };
				}
			})
		);
	}

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------
	let index: ThemeIndex = { themes: [], activeThemeId: null };
	let busy = false;
	let refreshSpin = false;
	let renamingId: string | null = null;
	let renameValue = '';

	// -------------------------------------------------------------------------
	// Init
	// -------------------------------------------------------------------------
	async function init() {
		const idx = await loadIndex();
		index = { ...idx, themes: await loadPreviews(idx.themes) };
	}

	async function refresh() {
		refreshSpin = true;
		setTimeout(() => (refreshSpin = false), 500);
		const idx = await loadIndex();
		index = { ...idx, themes: await loadPreviews(idx.themes) };
	}

	// -------------------------------------------------------------------------
	// Import
	// -------------------------------------------------------------------------
	async function importTheme() {
		try {
			const result = await os.showOpenDialog('Select Bootstrapper Theme', {
				filters: [{ name: 'Bootstrapper Theme', extensions: ['xml', 'zip'] }],
			});
			if (!result || result.length === 0) return;

			const sourcePath = result[0];
			const fileName = sourcePath.split('/').pop() ?? 'theme';
			const defaultName = fileName.replace(/\.(xml|zip)$/i, '');
			const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

			busy = true;

			const tBase = await themesDir();
			if (!(await shellFS.exists(tBase))) await shellFS.createDirectory(tBase);
			const tDir = await themeDir(id);

			let hasAssets = false;

			if (sourcePath.toLowerCase().endsWith('.zip')) {
				const tempDir = await shellFS.createTempDir({ baseDir: '/tmp', prefix: 'ablox-theme.XXXXXX' });
				try {
					await shell('ditto', ['-xk', sourcePath, tempDir], { skipStderrCheck: true });

					// Resolve the actual root: if the ZIP contained a single folder, look inside it
					let extractRoot = tempDir;
					const topEntries = (await shellFS.listDirectory(tempDir)).filter((e) => e && e !== '__MACOSX');
					if (topEntries.length === 1) {
						const candidate = path.join(tempDir, topEntries[0]);
						if (await shellFS.exists(path.join(candidate, 'Theme.xml'))) {
							extractRoot = candidate;
						}
					}

					if (!(await shellFS.exists(path.join(extractRoot, 'Theme.xml')))) {
						throw new Error('ZIP does not contain Theme.xml.');
					}
					await shellFS.copy(extractRoot, tDir, true);
					const entries = await shellFS.listDirectory(tDir);
					hasAssets = entries.some((e) => e && e !== 'Theme.xml');
				} catch (e) {
					if (await shellFS.exists(tDir)) await shellFS.remove(tDir);
					throw e;
				} finally {
					await shellFS.remove(tempDir);
				}
			} else {
				await shellFS.createDirectory(tDir);
				await shellFS.copy(sourcePath, path.join(tDir, 'Theme.xml'));

				// Copy any sibling assets from the XML's directory (e.g. assets/ folder, fonts, images)
				const sourceDir = path.dirname(sourcePath);
				const sourceXmlName = path.basename(sourcePath);
				const siblings = await shellFS.listDirectory(sourceDir);
				for (const entry of siblings) {
					if (!entry || entry === sourceXmlName) continue;
					await shellFS.copy(path.join(sourceDir, entry), path.join(tDir, entry), true);
				}

				const entries = await shellFS.listDirectory(tDir);
				hasAssets = entries.some((e) => e && e !== 'Theme.xml');
			}

			const newThemeMeta: ThemeMeta = { id, name: defaultName, hasAssets };
			const [withPreviews] = await loadPreviews([newThemeMeta]);
			index = { ...index, themes: [...index.themes, withPreviews] };
			await saveIndex(index);

			renamingId = id;
			renameValue = defaultName;
		} catch (e) {
			toast.error(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			busy = false;
		}
	}

	// -------------------------------------------------------------------------
	// Activate
	// -------------------------------------------------------------------------
	async function activateTheme(id: string) {
		const theme = index.themes.find((t) => t.id === id);
		if (!theme) return;

		busy = true;
		try {
			const xmlSrc = await themeXmlPath(id);
			const tDir = await themeDir(id);
			const aXml = await activeXmlPath();
			const aAssets = await activeAssetsPath();

			await shellFS.copy(xmlSrc, aXml);

			if (await shellFS.exists(aAssets)) await shellFS.remove(aAssets);
			if (theme.hasAssets) await shellFS.copy(tDir, aAssets, true);

			index = { ...index, activeThemeId: id };
			await saveIndex(index);
			toast.success(`"${theme.name}" is now active. Takes effect next Roblox launch.`);
		} catch (e) {
			toast.error(`Activation failed: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			busy = false;
		}
	}

	// -------------------------------------------------------------------------
	// Delete
	// -------------------------------------------------------------------------
	async function deleteTheme(id: string) {
		const theme = index.themes.find((t) => t.id === id);
		if (!theme) return;

		busy = true;
		try {
			const tDir = await themeDir(id);
			if (await shellFS.exists(tDir)) await shellFS.remove(tDir);

			const wasActive = index.activeThemeId === id;
			index = {
				themes: index.themes.filter((t) => t.id !== id),
				activeThemeId: wasActive ? null : index.activeThemeId,
			};

			if (wasActive) {
				const aXml = await activeXmlPath();
				const aAssets = await activeAssetsPath();
				if (await shellFS.exists(aXml)) await shellFS.remove(aXml);
				if (await shellFS.exists(aAssets)) await shellFS.remove(aAssets);
			}

			await saveIndex(index);
			toast.success(`"${theme.name}" deleted.${wasActive ? ' Active theme cleared.' : ''}`);
		} catch (e) {
			toast.error(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			busy = false;
		}
	}

	// -------------------------------------------------------------------------
	// Rename
	// -------------------------------------------------------------------------
	function startRename(id: string, currentName: string) {
		renamingId = id;
		renameValue = currentName;
	}

	async function commitRename(id: string) {
		const name = renameValue.trim();
		renamingId = null;
		if (!name) return;
		index = {
			...index,
			themes: index.themes.map((t) => (t.id === id ? { ...t, name } : t)),
		};
		await saveIndex(index);
	}

	function handleRenameKey(e: KeyboardEvent, id: string) {
		if (e.key === 'Enter') commitRename(id);
		else if (e.key === 'Escape') renamingId = null;
	}

	// -------------------------------------------------------------------------
	// Reveal in Finder
	// -------------------------------------------------------------------------
	async function revealTheme(id: string) {
		const xmlPath = await themeXmlPath(id);
		if (await shellFS.exists(xmlPath)) await shellFS.open(xmlPath, { reveal: true });
	}

	// -------------------------------------------------------------------------
	// 3D hover
	// -------------------------------------------------------------------------
	function handleMouseMove(event: MouseEvent) {
		const card = event.currentTarget as HTMLElement;
		const rect = card.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const rotateX = ((y - rect.height / 2) / rect.height) * -5;
		const rotateY = ((x - rect.width / 2) / rect.width) * 5;
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

{#await init()}
	<div class="flex items-center justify-center py-8">
		<RefreshCcw class="h-5 w-5 animate-spin text-muted-foreground" />
	</div>
{:then}
	<div class="space-y-4">
		<!-- Header -->
		<div class="flex items-center justify-between gap-4">
			<div class="min-w-0">
				<h3 class="text-2xl font-bold text-foreground">Theme Manager</h3>
				<p class="text-sm text-muted-foreground truncate">Bloxstrap / Fishstrap compatible themes for the Roblox launch screen</p>
			</div>
			<div class="flex gap-2 shrink-0">
				<Button variant="outline" size="sm" on:click={importTheme} disabled={busy}>
					<Plus class="h-4 w-4 mr-2" />
					Import Theme
				</Button>
				<Button variant="outline" size="sm" on:click={refresh}>
					<RefreshCcw class={`h-4 w-4 ${refreshSpin ? 'animate-spin' : ''}`} />
				</Button>
			</div>
		</div>

		<!-- Theme grid -->
		{#if index.themes.length > 0}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				{#each index.themes as theme (theme.id)}
					{@const isActive = theme.id === index.activeThemeId}
					<div
						class="theme-card"
						on:mousemove={handleMouseMove}
						on:mouseleave={handleMouseLeave}
						transition:fade={{ duration: 150 }}
						role="group"
						aria-label="Theme {theme.name}"
					>
						<Card.Root class="theme-card-wrapper h-full border overflow-hidden {isActive ? 'border-emerald-500/50' : ''}">
							<Card.Content class="p-0 h-full flex flex-col">
								<!-- Preview area -->
								<div class="preview-container relative w-full h-48 bg-muted/30 overflow-hidden">
									{#if theme.previewUrls && theme.previewUrls.length > 0}
										<div class="stacked-previews">
											{#each theme.previewUrls.slice(0, 3) as imgUrl, i}
												<div
													class="preview-image"
													style="--offset: {i}; z-index: {3 - i}; transform: translate({i * 8}px, {i * 8}px) rotate({i * 2}deg);"
												>
													<img
														src={imgUrl}
														alt="Preview {i + 1}"
														class="w-full h-full object-cover"
														on:error={handleImageError}
													/>
												</div>
											{/each}
										</div>
									{:else}
										<div class="flex items-center justify-center h-full">
											<Monitor class="h-16 w-16 text-muted-foreground/20" />
										</div>
									{/if}

									{#if isActive}
										<div class="absolute top-2 right-2">
											<Badge class="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[11px]">Active</Badge>
										</div>
									{/if}
								</div>

								<!-- Info section -->
								<div class="p-4 flex-1 flex flex-col gap-2">
									<!-- Name / inline rename -->
									{#if renamingId === theme.id}
										<div class="flex items-center gap-1.5">
											<Input
												class="h-7 text-sm flex-1 px-2 py-0 min-w-0"
												bind:value={renameValue}
												on:keydown={(e) => handleRenameKey(e, theme.id)}
												autofocus
											/>
											<button
												class="text-emerald-400 hover:text-emerald-300 p-1 shrink-0"
												on:click={() => commitRename(theme.id)}
												title="Save name"
											>
												<Check class="h-3.5 w-3.5" />
											</button>
											<button
												class="text-muted-foreground hover:text-foreground p-1 shrink-0"
												on:click={() => (renamingId = null)}
												title="Cancel"
											>
												<X class="h-3.5 w-3.5" />
											</button>
										</div>
									{:else}
										<div class="flex items-start justify-between gap-2 mb-1">
											<h3 class="font-bold text-foreground text-lg truncate">{theme.name}</h3>
											{#if theme.hasAssets}
												<Badge variant="secondary" class="text-[10px] shrink-0">+ assets</Badge>
											{/if}
										</div>
									{/if}

									<!-- Actions -->
									<div class="flex items-center gap-1.5 mt-auto">
										{#if isActive}
											<Button variant="secondary" size="sm" class="h-7 text-[11px] px-2 text-emerald-400 cursor-default flex-1" disabled>
												Active
											</Button>
										{:else}
											<Button
												variant="outline"
												size="sm"
												class="h-7 text-[11px] px-2 flex-1"
												on:click={() => activateTheme(theme.id)}
												disabled={busy}
											>
												Set Active
											</Button>
										{/if}

										<button
											class="text-muted-foreground hover:text-foreground p-1.5 rounded transition-colors"
											on:click={() => startRename(theme.id, theme.name)}
											title="Rename"
										>
											<Pencil class="h-3.5 w-3.5" />
										</button>

										<button
											class="text-muted-foreground hover:text-foreground p-1.5 rounded transition-colors"
											on:click={() => revealTheme(theme.id)}
											title="Reveal in Finder"
										>
											<FolderOpen class="h-3.5 w-3.5" />
										</button>

										<button
											class="text-muted-foreground hover:text-destructive p-1.5 rounded transition-colors"
											on:click={() => deleteTheme(theme.id)}
											title="Delete"
											disabled={busy}
										>
											<Trash2 class="h-3.5 w-3.5" />
										</button>
									</div>
								</div>
							</Card.Content>
						</Card.Root>
					</div>
				{/each}
			</div>
		{:else}
			<Alert.Root>
				<Alert.Title>No themes imported</Alert.Title>
				<Alert.Description>Import an XML or ZIP bootstrapper theme to get started.</Alert.Description>
			</Alert.Root>
		{/if}
	</div>
{:catch err}
	<p class="text-red-500 text-sm">Failed to load: {err}</p>
{/await}

<style>
	.theme-card {
		--rotate-x: 0deg;
		--rotate-y: 0deg;
		transition: transform 0.2s ease-out;
		transform: perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y));
	}

	.theme-card:hover {
		transform: perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y)) scale(1.02);
	}

	.theme-card :global(.theme-card-wrapper) {
		background: hsl(var(--card));
		border-radius: 1rem;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		transition: box-shadow 0.3s ease;
	}

	.theme-card:hover :global(.theme-card-wrapper) {
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

	.theme-card:hover .preview-image {
		transform: translate(calc(var(--offset) * 12px), calc(var(--offset) * 12px))
			rotate(calc(var(--offset) * 3deg)) !important;
	}
</style>
