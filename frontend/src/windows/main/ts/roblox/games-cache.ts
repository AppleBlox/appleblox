import { filesystem } from '@neutralinojs/lib';
import path from 'path-browserify';
import { getDataDir } from '../utils/paths';
import Logger from '@/windows/main/ts/utils/logger';

const logger = Logger.withContext('GamesCache');

const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_FILE = 'recent-games-cache.json';

export interface CachedGame {
	placeId: string;
	universeId: string;
	name: string;
	creator: string;
	iconUrl: string;
	lastPlayed: number;
}

interface CacheData {
	games: CachedGame[];
	timestamp: number;
}

let memoryCache: CachedGame[] | null = null;
let memoryCacheTimestamp = 0;

/**
 * Get the path to the games cache file
 */
async function getCachePath(): Promise<string> {
	const dataDir = await getDataDir();
	return path.join(dataDir, 'cache', CACHE_FILE);
}

/**
 * Get cached recent games (memory first, then disk)
 * Returns null if no valid cache exists
 */
export async function getCachedRecentGames(): Promise<CachedGame[] | null> {
	// 1. Check memory cache
	if (memoryCache && Date.now() - memoryCacheTimestamp < CACHE_DURATION_MS) {
		return memoryCache;
	}

	// 2. Check disk cache
	try {
		const cachePath = await getCachePath();
		const content = await filesystem.readFile(cachePath);
		const parsed: CacheData = JSON.parse(content);

		if (parsed && Array.isArray(parsed.games) && parsed.timestamp) {
			if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
				memoryCache = parsed.games;
				memoryCacheTimestamp = parsed.timestamp;
				logger.debug(`Loaded ${parsed.games.length} games from disk cache`);
				return parsed.games;
			}
			// Cache expired but return stale data for instant display
			// The caller should still refresh in the background
			memoryCache = parsed.games;
			memoryCacheTimestamp = parsed.timestamp;
			logger.debug(`Loaded ${parsed.games.length} games from stale disk cache`);
			return parsed.games;
		}
	} catch {
		// No cache file or invalid
	}

	return null;
}

/**
 * Save recent games to both memory and disk cache
 */
export async function setCachedRecentGames(games: CachedGame[]): Promise<void> {
	memoryCache = games;
	memoryCacheTimestamp = Date.now();

	try {
		const cachePath = await getCachePath();
		const cacheDir = path.dirname(cachePath);

		try {
			await filesystem.createDirectory(cacheDir);
		} catch {
			// Directory may already exist
		}

		const cacheData: CacheData = {
			games,
			timestamp: Date.now(),
		};

		await filesystem.writeFile(cachePath, JSON.stringify(cacheData));
		logger.debug(`Saved ${games.length} games to disk cache`);
	} catch (error) {
		logger.warn('Failed to save games cache:', error);
	}
}
