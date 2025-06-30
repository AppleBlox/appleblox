<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog';
	import Cat from '@/assets/panel/cat.gif';
	import { os, storage } from '@neutralinojs/lib';
	import path from 'path-browserify';
	import { onMount } from 'svelte';
	import { quintOut } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	import type { Mod } from '../../ts/workshop';
	import { downloadMod, type ProgressUpdate } from '../../ts/workshop';
	import Roblox from '../../ts/roblox';
	import shellFS from '../../ts/tools/shellfs';

	export let mod: Mod;
	let thumbnailUrl = `https://66.33.22.138/api/v1/mods/${mod.id}/image`;
	let dialogOpen = false;
	let imageLoaded = false;
	let imageLoading = true;

    let openAlert = false;

	// Installation state
	let isInstalling = false;
	let installProgress = 0;
	let installStep = '';
	let currentAsset = '';
	let installError = '';
	let installSuccess = false;

	/** Generate gradient based on mod name */
	function generateGradient(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}

		const colors = [
			['#667eea', '#764ba2'], // Purple-blue
			['#f093fb', '#f5576c'], // Pink-red
			['#4facfe', '#00f2fe'], // Blue-cyan
			['#43e97b', '#38f9d7'], // Green-cyan
			['#fa709a', '#fee140'], // Pink-yellow
			['#a8edea', '#fed6e3'], // Cyan-pink
			['#ff9a9e', '#fecfef'], // Pink-light
			['#ffecd2', '#fcb69f'], // Yellow-orange
			['#667eea', '#764ba2'], // Purple-blue
			['#96fbc4', '#f9f047'], // Green-yellow
		];

		const colorIndex = Math.abs(hash) % colors.length;
		const [color1, color2] = colors[colorIndex];

		return `linear-gradient(135deg, ${color1}, ${color2})`;
	}

	const CACHE_KEY = 'mod_thumbnails';
	const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

	async function getCachedImage(modId: string): Promise<string | null> {
		try {
			const cache = await storage.getData(CACHE_KEY);
			if (!cache) return null;

			const parsed = JSON.parse(cache);
			const entry = parsed[modId];

			if (!entry) return null;

			// Check if cache is expired
			if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
				delete parsed[modId];
				await storage.setData(CACHE_KEY, JSON.stringify(parsed));
				return null;
			}

			return entry.data;
		} catch (error: any) {
			// Neutralino throws NE_ST_NOSTKEX when key doesn't exist - this is normal
			if (error?.code === 'NE_ST_NOSTKEX') {
				return null;
			}
			console.warn('Failed to get cached image:', error);
			return null;
		}
	}

	async function setCachedImage(modId: string, dataUrl: string): Promise<void> {
		try {
			let cache: string | null = null;
			try {
				cache = await storage.getData(CACHE_KEY);
			} catch (error: any) {
				// Key doesn't exist yet - this is normal for first time
				if (error?.code !== 'NE_ST_NOSTKEX') {
					throw error;
				}
			}
			
			const parsed = cache ? JSON.parse(cache) : {};

			parsed[modId] = {
				data: dataUrl,
				timestamp: Date.now(),
			};

			await storage.setData(CACHE_KEY, JSON.stringify(parsed));
		} catch (error: any) {
			console.warn('Failed to cache image:', error);
			// Ignore cache errors
		}
	}

	// Handle image load failure at the browser level
	function handleImageError(): void {
		imageLoaded = false;
		imageLoading = false;
	}

	async function loadImage(): Promise<void> {
		imageLoading = true;
		imageLoaded = false;

		// Check cache first
		const cached = await getCachedImage(mod.id);
		if (cached) {
			thumbnailUrl = cached;
			imageLoaded = true;
			imageLoading = false;
			return;
		}

		// Load from network
		try {
			const response = await fetch(`https://marketplace.appleblox.com/api/v1/mods/${mod.id}/image`);
			if (!response.ok) throw new Error('Failed to load image');

			const blob = await response.blob();
			const reader = new FileReader();

			reader.onload = async () => {
				const dataUrl = reader.result as string;
				thumbnailUrl = dataUrl;
				imageLoaded = true;
				imageLoading = false;
				await setCachedImage(mod.id, dataUrl);
			};

			reader.onerror = () => {
				// If image fails to load, show gradient instead
				imageLoaded = false;
				imageLoading = false;
			};

			reader.readAsDataURL(blob);
		} catch (error: any) {
			console.warn('Failed to load image from network:', error);
			// If image fails to load, show gradient instead
			imageLoaded = false;
			imageLoading = false;
		}
	}

	function toggleDialog() {
		dialogOpen = !dialogOpen;
	}

	async function handleInstall() {
		if (isInstalling) return;

		isInstalling = true;
		installProgress = 0;
		installStep = '';
		currentAsset = '';
		installError = '';
		installSuccess = false;

		const onProgress = (update: ProgressUpdate) => {
			if (update.resetProgress) {
				installProgress = 0;
			}
			installStep = update.step;
			installProgress = update.progress;
			currentAsset = update.currentAsset || '';
		};

		try {
			const result = await downloadMod(mod.id, '', onProgress);

			if (result.success) {
				installSuccess = true;
				installStep = 'Installation completed successfully!';
				installProgress = 100;
				setTimeout(() => {
					isInstalling = false;
					installSuccess = false;
					dialogOpen = false;
				}, 2000);
			} else {
				installError = result.error || 'Installation failed';
				isInstalling = false;
			}
		} catch (error: any) {
			installError = error instanceof Error ? error.message : 'Unknown error occurred';
			isInstalling = false;
		}
	}

	function resetInstallState() {
		isInstalling = false;
		installProgress = 0;
		installStep = '';
		currentAsset = '';
		installError = '';
		installSuccess = false;
	}

	async function checkModExists(): Promise<boolean> {
		try {
			const modPath = path.join(await os.getEnv('HOME'), 'Library/Application Support/AppleBlox/mods', mod.name);
			return await shellFS.exists(modPath);
		} catch (error: any) {
			console.warn('Failed to check if mod exists:', error);
			return false;
		}
	}

	onMount(() => {
		loadImage();
	});
</script>

<!-- Loading Overlay -->
{#if imageLoading}
	<div
		class="fixed inset-0 bg-background bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center"
		transition:fade={{ duration: 300, easing: quintOut }}
	>
		<div class="flex flex-col items-center space-y-4" transition:fade={{ duration: 500, delay: 200, easing: quintOut }}>
			<img src={Cat} alt="Loading..." class="w-32 h-32 opacity-75 animate-pulse" />
		</div>
	</div>
{/if}

<!-- Card -->
<Card.Root
	class="relative w-full max-w-sm overflow-hidden group transition-all duration-500 ease-out hover:scale-105 cursor-pointer bg-background/50 backdrop-blur-sm border border-border/50 shadow-lg hover:shadow-xl"
	on:click={toggleDialog}
>
	<!-- Thumbnail -->
	<div class="w-full aspect-video overflow-hidden transition-all duration-500 group-hover:blur-md">
		{#if imageLoading}
			<div class="w-full h-full bg-transparent"></div>
		{:else if imageLoaded}
			<img
				src={thumbnailUrl}
				alt={`Thumbnail for ${mod.name}`}
				class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
				on:error={handleImageError}
			/>
		{:else}
			<div
				class="w-full h-full flex items-center justify-center text-white font-semibold text-lg transition-transform duration-500 group-hover:scale-110"
				style="background: {generateGradient(mod.name)}"
			>
				{mod.name.charAt(0).toUpperCase()}
			</div>
		{/if}
	</div>

	<!-- Card Content -->
	<Card.Content class="p-4 transition-all duration-500 group-hover:blur-md">
		<div class="space-y-2">
			<h3 class="text-lg font-semibold text-foreground truncate">{mod.name}</h3>
			<p class="text-sm text-muted-foreground">by {mod.author}</p>
		</div>
	</Card.Content>

	<!-- Hover Overlay with More Button -->
	<div
		class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none bg-background/20 backdrop-blur-sm"
	>
		<Button
			variant="outline"
			class="pointer-events-auto font-mono text-sm px-8 py-3 bg-background/80 backdrop-blur-sm hover:bg-background hover:scale-105 transition-all duration-300"
			on:click={() => {
				dialogOpen = true;
			}}
		>
			See more
		</Button>
	</div>
</Card.Root>

<!-- Dialog -->
<Dialog.Root
	bind:open={dialogOpen}
	onOpenChange={(open) => {
		if (!open) resetInstallState();
	}}
>
	<Dialog.Content class="max-w-md mx-auto bg-background/95 backdrop-blur-md border border-border/50 max-h-[90vh] flex flex-col">
		<Dialog.Header class="space-y-3 flex-shrink-0">
			<Dialog.Title class="text-xl font-semibold">{mod.name}</Dialog.Title>
			<Dialog.Description class="text-muted-foreground">
				by {mod.author}
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex-1 overflow-y-auto space-y-4 min-h-0">
			<!-- Thumbnail -->
			<div class="w-full aspect-video overflow-hidden rounded-lg border border-border/30">
				{#if imageLoading}
					<div class="w-full h-full bg-transparent"></div>
				{:else if imageLoaded}
					<img
						src={thumbnailUrl}
						alt={`Thumbnail for ${mod.name}`}
						class="w-full h-full object-cover"
						on:error={handleImageError}
					/>
				{:else}
					<div
						class="w-full h-full flex items-center justify-center text-white font-bold text-4xl"
						style="background: {generateGradient(mod.name)}"
					>
						{mod.name.charAt(0).toUpperCase()}
					</div>
				{/if}
			</div>

			<!-- Installation Progress -->
			{#if isInstalling}
				<div class="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/30">
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<h4 class="text-sm font-medium text-foreground">Installing...</h4>
							<span class="text-xs text-muted-foreground">{Math.round(installProgress)}%</span>
						</div>

						<!-- Progress Bar -->
						<div class="w-full bg-muted rounded-full h-2">
							<div
								class="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
								style="width: {installProgress}%"
							></div>
						</div>

						<!-- Status Text -->
						<p class="text-xs text-muted-foreground">{installStep}</p>

						<!-- Current Asset -->
						{#if currentAsset}
							<p class="text-xs text-muted-foreground font-mono truncate">
								Asset: {currentAsset}
							</p>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Installation Error -->
			{#if installError}
				<div class="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
					<h4 class="text-sm font-medium text-destructive mb-1">Installation Failed</h4>
					<p class="text-xs text-destructive/80">{installError}</p>
				</div>
			{/if}

			<!-- Installation Success -->
			{#if installSuccess}
				<div class="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
					<h4 class="text-sm font-medium text-green-600 mb-1">Installation Successful</h4>
					<p class="text-xs text-green-600/80">Mod has been installed successfully!</p>
				</div>
			{/if}

			<div class="space-y-3">
				<div>
					<h4 class="text-sm font-medium text-foreground mb-1">Description</h4>
					<div class="max-h-32 overflow-y-auto">
						<p class="text-sm text-muted-foreground leading-relaxed">
							{mod.description}
						</p>
					</div>
				</div>

				{#if mod.fileVersion}
					<div>
						<h4 class="text-sm font-medium text-foreground mb-1">Compatibility</h4>
						<p class="text-sm text-muted-foreground font-mono">
							{#if mod.clientVersionUpload === Roblox.Version.version}
								<span class="text-green-500">This mod is compatible with your current Roblox version</span>
							{:else}
								<span class="text-yellow-500"
									>This mod is made for another version of Roblox than the currently installed one. Expect
									issues.</span
								>
							{/if}
						</p>
					</div>
				{/if}
			</div>
		</div>

		<Dialog.Footer class="flex gap-3 pt-6 flex-shrink-0">
			<Button variant="outline" on:click={toggleDialog} class="flex-1" disabled={isInstalling}>Cancel</Button>
			<Button
				class="flex-1 bg-primary hover:bg-primary/90"
				on:click={async () => {
					const modExists = await checkModExists();
					if (modExists) {
                        openAlert = true;
					} else {
                        handleInstall();
                    }
				}}
				disabled={isInstalling || installSuccess}
			>
				{#if isInstalling}
					Installing...
				{:else if installSuccess}
					Installed
				{:else if installError}
					Retry Install
				{:else}
					Install
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={openAlert}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
      <AlertDialog.Description class="text-red-300">
        A mod with the same name is already installed. It will be overwritten.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action on:click={handleInstall}>Continue</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>