<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '$lib/components/ui/dialog/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';

	import {
		RobloxDownloader,
		type MacArchitecture,
		type MacBinaryType,
		type ProgressInfo,
	} from '@/windows/main/ts/roblox/downloader';
	import path from 'path-browserify';
	import { createEventDispatcher } from 'svelte';
	import { toast } from 'svelte-sonner';
	import shellFS from '../../ts/tools/shellfs';
	import Alert from '../alert.svelte';

	export let binaryType: MacBinaryType = 'MacPlayer';
	export let channel: string = 'LIVE';

	const dispatch = createEventDispatcher();

	export let open = false;
	let downloading = false;
	let progress: ProgressInfo = { message: '', percentage: 0 };
	let downloadCompleted = false;
	let downloadController: AbortController | null = null;
	let currentDownloadPath: string | null = null;

	// Determine system architecture and set default
	const systemArch = window.NL_ARCH;
	const architecture: MacArchitecture = systemArch === 'x64' ? 'intel' : 'apple';

	const DOWNLOAD_PATH = `/tmp/`;

	async function startDownload() {
		downloading = true;
		downloadCompleted = false;
		progress = { message: 'Initializing download...', percentage: 0 };
		downloadController = new AbortController();

		try {
			const downloader = new RobloxDownloader({
				binaryType,
				architecture,
				channel,
				onProgress: (progressInfo: ProgressInfo) => {
					progress = progressInfo;
				},
				signal: downloadController.signal,
			});

			const filename = binaryType === 'MacPlayer' ? 'RobloxPlayer.zip' : 'RobloxStudioApp.zip';
			const fullPath = `${DOWNLOAD_PATH}${filename}`;
			currentDownloadPath = fullPath;

			const result = await downloader.download(fullPath);

			// Check if download was cancelled
			if (downloadController?.signal.aborted) {
				return;
			}

			downloadCompleted = true;
			downloading = false;
			currentDownloadPath = null;

			await downloader.moveToApplicationsFolder(path.join(DOWNLOAD_PATH, 'RobloxPlayer.zip'), 'Roblox.app');

			dispatch('downloadComplete', result);
		} catch (error) {
			downloading = false;
			downloadCompleted = false;
			currentDownloadPath = null;

			if (downloadController?.signal.aborted) {
				toast.info('Download cancelled', {
					description: 'Download was cancelled by user',
				});
				return;
			}

			console.error('Download failed:', error);

			toast.error('Download failed', {
				description: error instanceof Error ? error.message : 'Unknown error occurred',
			});
		}
	}

	async function cancelDownload() {
		if (downloadController) {
			downloadController.abort();
		}

		downloading = false;
		progress = { message: 'Cancelling download...', percentage: 0 };

		// Clean up partial file if it exists
		if (currentDownloadPath) {
			try {
				const fileExists = await shellFS.exists(currentDownloadPath);
				if (fileExists) {
					await shellFS.remove(currentDownloadPath);
					toast.info('Partial download cleaned up', {
						description: 'Incomplete files have been removed',
					});
				}
			} catch (error) {
				console.warn('Failed to clean up partial file:', error);
			}
			currentDownloadPath = null;
		}

		downloadController = null;
		progress = { message: '', percentage: 0 };
	}

	async function handleDialogOpenChange(open: boolean) {
		if (!open && downloading) {
			// User is trying to close while downloading - cancel the download
			await cancelDownload();
		}

		open = open;

		if (!open) {
			// Reset state when dialog closes
			downloadCompleted = false;
			progress = { message: '', percentage: 0 };
		}
	}

	async function handleCancelClick() {
		await cancelDownload();
		open = false;
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function formatTime(seconds: number | undefined): string {
		if (!seconds || !isFinite(seconds)) return '';
		if (seconds < 60) return `${Math.round(seconds)}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = Math.round(seconds % 60);
		return `${minutes}m ${remainingSeconds}s`;
	}

	$: binaryDisplayName = binaryType === 'MacPlayer' ? 'Roblox Player' : 'Roblox Studio';
</script>

<Dialog bind:open onOpenChange={handleDialogOpenChange}>
	<DialogContent class="sm:max-w-[425px]">
		<DialogHeader>
			<DialogTitle>Download Roblox</DialogTitle>
			<DialogDescription>Download the latest version of Roblox for macOS</DialogDescription>
		</DialogHeader>

		<div class="space-y-4">
			<Card>
				<CardHeader class="pb-3">
					<CardTitle class="text-base">Download Configuration</CardTitle>
				</CardHeader>
				<CardContent class="space-y-3">
					<div class="flex justify-between items-center">
						<span class="text-sm text-muted-foreground">Binary Type:</span>
						<Badge variant="secondary">{binaryDisplayName}</Badge>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-sm text-muted-foreground">Architecture:</span>
						<Badge variant="secondary">{architecture === 'intel' ? 'Intel' : 'Apple Silicon'}</Badge>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-sm text-muted-foreground">Channel:</span>
						<Badge variant="outline">{channel}</Badge>
					</div>
				</CardContent>
			</Card>

			{#if downloading}
				<Card>
					<CardHeader class="pb-3">
						<CardTitle class="text-base flex items-center justify-between">
							<span>Downloading...</span>
							<Button
								variant="ghost"
								size="sm"
								on:click={handleCancelClick}
								class="text-red-600 hover:text-red-700"
							>
								Cancel
							</Button>
						</CardTitle>
						<CardDescription>{progress.message}</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="space-y-3">
							<Progress value={progress.percentage} class="h-2" />

							<div class="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
								<div class="space-y-1">
									<div class="flex justify-between">
										<span>Progress:</span>
										<span class="font-medium">{progress.percentage.toFixed(1)}%</span>
									</div>
									{#if progress.downloadedBytes && progress.totalBytes}
										<div class="flex justify-between">
											<span>Downloaded:</span>
											<span class="font-medium"
												>{progress.downloadedFormatted || formatBytes(progress.downloadedBytes)}</span
											>
										</div>
										<div class="flex justify-between">
											<span>Total:</span>
											<span class="font-medium"
												>{progress.totalFormatted || formatBytes(progress.totalBytes)}</span
											>
										</div>
									{:else if progress.downloadedBytes}
										<div class="flex justify-between">
											<span>Downloaded:</span>
											<span class="font-medium"
												>{progress.downloadedFormatted || formatBytes(progress.downloadedBytes)}</span
											>
										</div>
									{/if}
								</div>

								<div class="space-y-1">
									{#if progress.speed || progress.speedFormatted}
										<div class="flex justify-between">
											<span>Speed:</span>
											<span class="font-medium"
												>{progress.speedFormatted || formatBytes(progress.speed || 0) + '/s'}</span
											>
										</div>
									{/if}
									{#if progress.timeRemaining}
										<div class="flex justify-between">
											<span>Time left:</span>
											<span class="font-medium">{formatTime(progress.timeRemaining)}</span>
										</div>
									{/if}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
				<Alert
					title="Download in progress"
					description="Closing this dialog will cancel the download and remove any incomplete files."
					variant="warning"
				/>
			{:else if downloadCompleted}
				<Alert
					title="Download completed successfully!"
					description="Roblox has been downloaded to your applications folder."
					variant="success"
				/>
			{:else}
				<Card>
					<CardContent class="pt-6">
						<Button on:click={startDownload} class="w-full" size="lg" disabled={downloading}>Start Download</Button>
					</CardContent>
				</Card>
			{/if}
		</div>
	</DialogContent>
</Dialog>
