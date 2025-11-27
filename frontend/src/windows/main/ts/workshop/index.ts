import { filesystem, os } from '@neutralinojs/lib';
import path from 'path-browserify';
import shellFS from '../tools/shellfs';
import Logger from '@/windows/main/ts/utils/logger';
import { getModsDir } from '../utils/paths';

const API_URL = 'https://marketplace.appleblox.com';

interface Mod {
	id: string;
	name: string;
	author: string;
	description: string;
	clientVersionUpload?: string;
	fileVersion?: number;
}

interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

interface CacheStatus {
	modId: string;
	cached: boolean;
	status?: string;
	assetsCount?: number;
	cachedAt?: number;
	startedAt?: number;
	completedAt?: number;
	error?: string;
}

interface AssetInfo {
	filename: string;
	size: number;
}

interface AssetsResponse {
	modId: string;
	assets: AssetInfo[];
	totalAssets: number;
	cachedAt: number;
}

interface ProgressUpdate {
	step: string;
	progress: number;
	currentAsset?: string;
	resetProgress?: boolean;
}

type ProgressCallback = (update: ProgressUpdate) => void;

const mods: Mod[] = [];

async function loadMods(): Promise<{ success: boolean; mods: Mod[] }> {
	if (mods.length > 0) return { success: true, mods };

	try {
		const response = await fetch(`${API_URL}/api/v1/mods`);
		const result: ApiResponse<Mod[]> = await response.json();

		if (!result.success || !result.data) {
			Logger.error('Failed to load mods:', result.error);
			return { success: false, mods: [] };
		}

		mods.length = 0;
		mods.push(...result.data);

		return { success: true, mods };
	} catch (error) {
		Logger.error('Error loading mods:', error);
		return { success: false, mods: [] };
	}
}

async function cacheModAssets(modId: string): Promise<{ success: boolean; message?: string; error?: string }> {
	try {
		const response = await fetch(`${API_URL}/api/v1/mods/${modId}/cache`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		const result = await response.json();

		if (!result.success) {
			return { success: false, error: result.error };
		}

		return { success: true, message: result.message };
	} catch (error) {
		Logger.error('Error caching mod assets:', error);
		return { success: false, error: 'Network error' };
	}
}

async function getCacheStatus(modId: string): Promise<CacheStatus | null> {
	try {
		const response = await fetch(`${API_URL}/api/v1/mods/${modId}/cache-status`);
		const result: ApiResponse<CacheStatus> = await response.json();

		if (!result.success || !result.data) {
			Logger.error('Failed to get cache status:', result.error);
			return null;
		}

		return result.data;
	} catch (error) {
		Logger.error('Error getting cache status:', error);
		return null;
	}
}

async function getModAssets(modId: string): Promise<AssetsResponse | null> {
	try {
		const response = await fetch(`${API_URL}/api/v1/mods/${modId}/assets`);
		const result: ApiResponse<AssetsResponse> = await response.json();

		if (!result.success || !result.data) {
			Logger.error('Failed to get mod assets:', result.error);
			return null;
		}

		return result.data;
	} catch (error) {
		Logger.error('Error getting mod assets:', error);
		return null;
	}
}

async function downloadAsset(modId: string, filename: string): Promise<ArrayBuffer | null> {
	try {
		const response = await fetch(`${API_URL}/api/v1/mods/${modId}/assets/${filename}`);

		if (!response.ok) {
			Logger.error('Failed to download asset:', response.statusText);
			return null;
		}

		return await response.arrayBuffer();
	} catch (error) {
		Logger.error('Error downloading asset:', error);
		return null;
	}
}

async function downloadMod(
	modId: string,
	downloadPath: string,
	onProgress?: ProgressCallback
): Promise<{ success: boolean; error?: string }> {
	if (mods.length < 1) await loadMods();
	const modInfo = mods.find((m) => m.id === modId);
	if (!modInfo) return { success: false, error: "Mod doesn't exist" };

	try {
		Logger.info(`Starting download for mod: ${modId}`);
		onProgress?.({ step: 'Initializing download...', progress: 0 });

		const cacheStatus = await getCacheStatus(modId);
		if (!cacheStatus) {
			return { success: false, error: 'Failed to check cache status' };
		}

		if (!cacheStatus.cached) {
			Logger.info('Mod not cached, starting cache process...');
			onProgress?.({ step: 'Starting server cache process...', progress: 10 });

			const cacheResult = await cacheModAssets(modId);
			if (!cacheResult.success) {
				return { success: false, error: cacheResult.error || 'Failed to cache mod' };
			}

			let attempts = 0;
			const maxAttempts = 60;
			onProgress?.({ step: 'Waiting for server to prepare assets...', progress: 20, resetProgress: true });

			while (attempts < maxAttempts) {
				await new Promise((resolve) => setTimeout(resolve, 5000));

				const status = await getCacheStatus(modId);
				if (!status) {
					return { success: false, error: 'Failed to check cache status during wait' };
				}

				if (status.cached) {
					Logger.info('Mod caching completed');
					onProgress?.({ step: 'Server preparation complete!', progress: 100 });
					break;
				}

				if (status.status === 'failed') {
					return { success: false, error: status.error || 'Caching failed' };
				}

				attempts++;
				const cacheProgress = 20 + (attempts / maxAttempts) * 70;
				onProgress?.({ step: `Waiting for server preparation... (${attempts}/${maxAttempts})`, progress: cacheProgress });
				Logger.info(`Waiting for cache completion... (${attempts}/${maxAttempts})`);
			}

			if (attempts >= maxAttempts) {
				return { success: false, error: 'Cache timeout - mod took too long to cache' };
			}
		} else {
			onProgress?.({ step: 'Mod already cached on server', progress: 30 });
		}

		onProgress?.({ step: 'Getting asset list...', progress: 0, resetProgress: true });
		const assetsResponse = await getModAssets(modId);
		if (!assetsResponse) {
			return { success: false, error: 'Failed to get mod assets list' };
		}

		onProgress?.({ step: 'Creating mod directory...', progress: 10 });
		const modPath = path.join(await getModsDir(), modInfo.name);
		if (await shellFS.exists(modPath)) await shellFS.remove(modPath);
		await shellFS.createDirectory(modPath);

		Logger.info(`Downloading ${assetsResponse.totalAssets} assets...`);
		let downloadedCount = 0;

		for (const asset of assetsResponse.assets) {
			const progressPercent = (downloadedCount / assetsResponse.totalAssets) * 80 + 20;
			onProgress?.({
				step: 'Downloading assets...',
				progress: progressPercent,
				currentAsset: asset.filename,
			});

			Logger.info(`Downloading asset: ${asset.filename} (${downloadedCount + 1}/${assetsResponse.totalAssets})`);

			const assetData = await downloadAsset(modId, asset.filename);
			if (!assetData) {
				Logger.warn(`Failed to download asset: ${asset.filename}`);
				continue;
			}

			const assetPath = path.join(modPath, asset.filename);
			await shellFS.createDirectory(path.dirname(assetPath));

			const uint8Array = new Uint8Array(assetData);
			await filesystem.writeBinaryFile(assetPath, uint8Array.buffer);

			downloadedCount++;
		}

		onProgress?.({ step: 'Saving mod information...', progress: 95 });
		await shellFS.writeFile(path.join(modPath, 'mod.json'), JSON.stringify(modInfo, null, 2));

		onProgress?.({ step: 'Downloading mod thumbnail...', progress: 98 });
		try {
			const imageResponse = await fetch(`${API_URL}/api/v1/mods/${modId}/image`);
			if (imageResponse.ok) {
				const imageData = await imageResponse.arrayBuffer();
				const imagePath = path.join(modPath, 'mod.png');
				const uint8Array = new Uint8Array(imageData);
				await filesystem.writeBinaryFile(imagePath, uint8Array.buffer);
			}
		} catch (error) {
			Logger.warn('Failed to download mod image:', error);
		}

		onProgress?.({ step: 'Installation complete!', progress: 100 });
		Logger.info(`Mod download completed: ${downloadedCount} assets downloaded`);
		return { success: true };
	} catch (error) {
		Logger.error('Error downloading mod:', error);
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

export {
	cacheModAssets,
	downloadAsset,
	downloadMod,
	getCacheStatus,
	getModAssets,
	loadMods,
	type AssetInfo,
	type AssetsResponse,
	type CacheStatus,
	type Mod,
	type ProgressCallback,
	type ProgressUpdate,
};
