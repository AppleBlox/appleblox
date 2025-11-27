import { os } from '@neutralinojs/lib';
import path from 'path-browserify';

/**
 * Global data directory override for testing purposes.
 * Can be set via environment variable APPLEBLOX_DATA_DIR or CLI argument --data-dir
 */
let dataDirectoryOverride: string | null = null;

/**
 * Initialize the data directory from environment variables or CLI arguments.
 * This should be called early in the application lifecycle.
 */
export async function initializeDataDirectory(): Promise<void> {
	// Check for CLI argument first
	if (window.NL_ARGS) {
		const dataDirArg = window.NL_ARGS.find((arg) => arg.startsWith('--data-dir='));
		if (dataDirArg) {
			dataDirectoryOverride = dataDirArg.split('=')[1];
			return;
		}
	}

	// Check for environment variable
	try {
		const envDataDir = await os.getEnv('APPLEBLOX_DATA_DIR');
		if (envDataDir) {
			dataDirectoryOverride = envDataDir;
			return;
		}
	} catch (e) {
		// Environment variable not set, use default
	}
}

/**
 * Get the base data directory for AppleBlox.
 * Returns the configured test directory or the default user data directory.
 *
 * @returns The absolute path to the AppleBlox data directory
 */
export async function getDataDir(): Promise<string> {
	if (dataDirectoryOverride) {
		return dataDirectoryOverride;
	}

	const home = await os.getEnv('HOME');
	return path.join(home, 'Library/Application Support/AppleBlox');
}

/**
 * Get the mods directory path.
 *
 * @returns The absolute path to the mods directory
 */
export async function getModsDir(): Promise<string> {
	return path.join(await getDataDir(), 'mods');
}

/**
 * Get the cache directory path.
 *
 * @returns The absolute path to the cache directory
 */
export async function getCacheDir(): Promise<string> {
	return path.join(await getDataDir(), 'cache');
}

/**
 * Get the mods cache directory (for backups).
 *
 * @returns The absolute path to the mods cache directory
 */
export async function getModsCacheDir(): Promise<string> {
	return path.join(await getCacheDir(), 'mods');
}

/**
 * Get the fonts cache directory.
 *
 * @returns The absolute path to the fonts cache directory
 */
export async function getFontsCacheDir(): Promise<string> {
	return path.join(await getCacheDir(), 'fonts');
}

/**
 * Get the config directory path (for settings files).
 *
 * @returns The absolute path to the config directory
 */
export async function getConfigDir(): Promise<string> {
	return await getDataDir();
}

/**
 * Set the data directory override for testing.
 * This should only be used in tests.
 *
 * @param dir The directory path to use for test data
 */
export function setTestDataDirectory(dir: string): void {
	dataDirectoryOverride = dir;
}

/**
 * Clear the data directory override (restore default behavior).
 * This should only be used in tests.
 */
export function clearTestDataDirectory(): void {
	dataDirectoryOverride = null;
}
