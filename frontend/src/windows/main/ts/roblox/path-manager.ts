import { getValue, setValue } from '../../components/settings';
import Logger from '../utils/logger';
import { detectRobloxPath, validateRobloxPath } from './path';

/**
 * Centralized Roblox path manager singleton.
 * Eliminates race conditions and provides synchronous access to Roblox installation path.
 */
class RobloxPathManager {
	private currentPath: string | null = null;
	private isInitialized: boolean = false;
	private initPromise: Promise<void> | null = null;
	private readonly settingsKey = 'roblox.installation.custom_path';

	/**
	 * Initializes the path manager by detecting or loading the Roblox installation path.
	 * Safe to call multiple times - subsequent calls wait for initial initialization.
	 */
	async initialize(): Promise<void> {
		// Prevent concurrent initialization
		if (this.isInitialized) {
			Logger.info('PathManager already initialized');
			return;
		}

		if (this.initPromise) {
			Logger.info('PathManager initialization in progress, waiting...');
			await this.initPromise;
			return;
		}

		this.initPromise = this._initializeInternal();
		await this.initPromise;
		this.initPromise = null;
	}

	private async _initializeInternal(): Promise<void> {
		try {
			Logger.info('Initializing Roblox PathManager...');

			// Strategy 1: Check for user override in settings
			let customPath: string | null = null;
			try {
				customPath = await getValue<string>(this.settingsKey);
				if (customPath) {
					Logger.info(`Found custom Roblox path in settings: ${customPath}`);

					// Validate custom path still exists
					if (await validateRobloxPath(customPath)) {
						this.currentPath = customPath;
						this.isInitialized = true;
						Logger.info(`Using custom Roblox path: ${customPath}`);
						return;
					} else {
						Logger.warn(`Custom path no longer valid, clearing from settings: ${customPath}`);
						await setValue(this.settingsKey, null);
					}
				}
			} catch (err) {
				Logger.info('No custom Roblox path set in settings');
			}

			// Strategy 2: Auto-detect Roblox installation
			Logger.info('Running auto-detection for Roblox...');
			const detected = await detectRobloxPath();

			if (detected) {
				this.currentPath = detected;
				Logger.info(`Auto-detected Roblox at: ${detected}`);
			} else {
				this.currentPath = null;
				Logger.warn('Roblox installation not found on this Mac');
			}

			this.isInitialized = true;
		} catch (err) {
			Logger.error('Error initializing PathManager:', err);
			this.currentPath = null;
			this.isInitialized = true; // Mark as initialized even on error to prevent retry loops
		}
	}

	/**
	 * Gets the current Roblox installation path.
	 * @returns The path to Roblox.app, or null if not found
	 * @throws Error if PathManager hasn't been initialized
	 */
	getPath(): string | null {
		if (!this.isInitialized) {
			throw new Error(
				'PathManager not initialized. Call PathManager.initialize() before accessing the path. ' +
					'This should be done in the app initialization phase.'
			);
		}
		return this.currentPath;
	}

	/**
	 * Re-runs Roblox detection and updates the current path.
	 * Useful when user clicks "Re-detect" button or when cached path becomes invalid.
	 * @returns The newly detected path, or null if not found
	 */
	async refreshPath(): Promise<string | null> {
		Logger.info('Refreshing Roblox path...');
		const detected = await detectRobloxPath();
		this.currentPath = detected;

		if (detected) {
			Logger.info(`Refreshed Roblox path: ${detected}`);
		} else {
			Logger.warn('No Roblox installation found after refresh');
		}

		return detected;
	}

	/**
	 * Sets a custom Roblox installation path (user override).
	 * Validates the path before saving.
	 * @param path - The custom path to Roblox.app
	 * @throws Error if the path is invalid
	 */
	async setCustomPath(path: string): Promise<void> {
		Logger.info(`Setting custom Roblox path: ${path}`);

		// Validate the path before saving
		if (!(await validateRobloxPath(path))) {
			throw new Error(`Invalid Roblox installation path: ${path}`);
		}

		// Save to settings
		await setValue(this.settingsKey, path);
		this.currentPath = path;

		Logger.info(`Custom Roblox path saved: ${path}`);
	}

	/**
	 * Clears the custom path override and reverts to auto-detection.
	 * Re-runs detection to find Roblox automatically.
	 */
	async clearCustomPath(): Promise<void> {
		Logger.info('Clearing custom Roblox path, reverting to auto-detection...');

		// Remove from settings
		await setValue(this.settingsKey, null);

		// Re-run auto-detection
		await this.refreshPath();

		Logger.info('Custom path cleared, now using auto-detection');
	}

	/**
	 * Checks if the current path is a user-specified custom path.
	 * @returns True if using custom path, false if auto-detected or not found
	 */
	async isCustomPath(): Promise<boolean> {
		try {
			const customPath = await getValue<string>(this.settingsKey);
			return customPath !== null && customPath !== undefined;
		} catch (err) {
			return false;
		}
	}

	/**
	 * Checks if PathManager has been initialized.
	 * @returns True if initialized
	 */
	isReady(): boolean {
		return this.isInitialized;
	}
}

// Export singleton instance
export const PathManager = new RobloxPathManager();
