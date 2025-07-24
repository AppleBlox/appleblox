import { filesystem, os } from '@neutralinojs/lib';
import path from 'path-browserify';
import shellFS from '../../ts/tools/shellfs';
import type { SettingsOutput } from './types';

export async function getConfigPath(): Promise<string> {
	return path.join(await os.getPath('data'), 'AppleBlox', 'config');
}

/** Saves the data provided to the Application Support folder */
const saveQueue: { [key: string]: string } = {};
let hasInterval = false;
let saveInterval: NodeJS.Timeout | null = null;

// Initialize save interval once
function initSaveInterval() {
	if (!hasInterval) {
		hasInterval = true;
		saveInterval = setInterval(() => {
			for (const [path, data] of Object.entries(saveQueue)) {
				filesystem.writeFile(path, data).catch((err) => {
					console.error('[Settings] ', err);
				});
				delete saveQueue[path];
			}
		}, 1000);
	}
}

// Initialize on module load
initSaveInterval();

// Keeps track of the debounces
const lastSaveTime = new Map<string, number>();
/** Saves the settings of a panel by its ID. Can only save a panel once every 100ms */
export async function saveSettings(panelId: string, data: Object): Promise<void> {
	const now = Date.now();
	const lastSave = lastSaveTime.get(panelId);

	// ignore save requests if they don't wait 100ms
	if (lastSave && now - lastSave < 100) {
		return;
	}

	// update the last save time
	lastSaveTime.set(panelId, now);

	try {
		const savePath = await getConfigPath();
		if (!(await shellFS.exists(savePath))) {
			await filesystem.createDirectory(savePath);
		}
		try {
			saveQueue[`${savePath}/${panelId}.json`] = JSON.stringify(data);
		} catch (err) {
			console.error('[Settings] ', err);
		}
	} catch (err) {
		throw err;
	}
}

/** Loads the data from the specified panelID */
export async function loadSettings(panelId: string): Promise<{ [key: string]: any } | undefined> {
	try {
		const filepath = `${await getConfigPath()}/${panelId}.json`;
		if (!(await shellFS.exists(filepath))) {
			return undefined;
		}
		return JSON.parse(await filesystem.readFile(filepath));
	} catch (err) {
		console.error('[Settings] ', err);
	}
}

interface CacheEntry {
	data: SettingsOutput;
	timestamp: number;
}

let settingsCache: { [key: string]: CacheEntry } = {};
const CACHE_LIFETIME = 1500; // Cache lifetime: 1.5 seconds (longer than save interval)

// Mutex system for preventing concurrent setValue operations per panel
const panelLocks = new Map<string, Promise<void>>();

/** Set the value of a setting with concurrency protection */
export async function setValue(settingPath: `${string}.${string}.${string}`, value: any, createNew = false): Promise<void> {
	const paths = settingPath.split('.');
	const panelId = paths[0];

	// Wait for any existing setValue operation on this panel to complete
	const existingLock = panelLocks.get(panelId);
	if (existingLock) {
		await existingLock;
	}

	// Create new lock for this operation
	const lockPromise = performSetValue(settingPath, value, createNew);
	panelLocks.set(panelId, lockPromise);

	try {
		await lockPromise;
	} finally {
		// Remove lock when operation completes
		panelLocks.delete(panelId);
	}
}

/** Internal function that performs the actual setValue operation */
async function performSetValue(settingPath: `${string}.${string}.${string}`, value: any, createNew = false): Promise<void> {
	const paths = settingPath.split('.');
	const panelId = paths[0];
	const categoryId = paths[1];
	const widgetId = paths[2];

	// Load fresh settings (bypassing cache to avoid stale data)
	let settings = await loadSettingsFromDisk(panelId);
	if (!settings) {
		if (createNew) {
			settings = {};
		} else {
			throw new Error(`The panel '${panelId}' doesn't exist.`);
		}
	}

	if (!settings[categoryId]) {
		if (createNew) {
			settings[categoryId] = {};
		} else {
			throw new Error(`The category '${categoryId}' doesn't exist.`);
		}
	}

	const category: { [key: string]: any } = settings[categoryId];
	if (!Object.keys(category).includes(widgetId) && !createNew) {
		throw new Error(`The widget '${widgetId}' doesn't exist.`);
	}

	settings[categoryId][widgetId] = value;

	// Update cache with new data
	settingsCache[panelId] = {
		data: settings,
		timestamp: Date.now(),
	};

	await saveSettings(panelId, settings);
}

/** Load settings directly from disk, bypassing cache */
async function loadSettingsFromDisk(panelId: string): Promise<{ [key: string]: any } | undefined> {
	try {
		const filepath = `${await getConfigPath()}/${panelId}.json`;
		if (!(await shellFS.exists(filepath))) {
			return undefined;
		}
		return JSON.parse(await filesystem.readFile(filepath));
	} catch (err) {
		console.error('[Settings] ', err);
		return undefined;
	}
}

/** Set multiple values atomically to prevent race conditions */
export async function setMultipleValues(
	updates: Array<{ path: `${string}.${string}.${string}`; value: any }>,
	createNew = false
): Promise<void> {
	// Group updates by panel
	const panelUpdates = new Map<string, Array<{ categoryId: string; widgetId: string; value: any }>>();

	for (const update of updates) {
		const [panelId, categoryId, widgetId] = update.path.split('.');
		if (!panelUpdates.has(panelId)) {
			panelUpdates.set(panelId, []);
		}
		panelUpdates.get(panelId)!.push({ categoryId, widgetId, value: update.value });
	}

	// Process each panel atomically
	const promises = Array.from(panelUpdates.entries()).map(async ([panelId, updates]) => {
		// Wait for any existing setValue operation on this panel
		const existingLock = panelLocks.get(panelId);
		if (existingLock) {
			await existingLock;
		}

		// Create lock for this batch operation
		const lockPromise = performMultipleSetValues(panelId, updates, createNew);
		panelLocks.set(panelId, lockPromise);

		try {
			await lockPromise;
		} finally {
			panelLocks.delete(panelId);
		}
	});

	await Promise.all(promises);
}

/** Internal function for batch setValue operations */
async function performMultipleSetValues(
	panelId: string,
	updates: Array<{ categoryId: string; widgetId: string; value: any }>,
	createNew: boolean
): Promise<void> {
	// Load fresh settings
	let settings = await loadSettingsFromDisk(panelId);
	if (!settings) {
		if (createNew) {
			settings = {};
		} else {
			throw new Error(`The panel '${panelId}' doesn't exist.`);
		}
	}

	// Apply all updates to the same settings object
	for (const update of updates) {
		const { categoryId, widgetId, value } = update;

		if (!settings[categoryId]) {
			if (createNew) {
				settings[categoryId] = {};
			} else {
				throw new Error(`The category '${categoryId}' doesn't exist.`);
			}
		}

		const category: { [key: string]: any } = settings[categoryId];
		if (!Object.keys(category).includes(widgetId) && !createNew) {
			throw new Error(`The widget '${widgetId}' doesn't exist.`);
		}

		settings[categoryId][widgetId] = value;
	}

	// Update cache with new data
	settingsCache[panelId] = {
		data: settings,
		timestamp: Date.now(),
	};

	await saveSettings(panelId, settings);
}

/** Get the value of a setting */
export async function getValue<T>(
	/** Path to the settings in panel.category.widget */
	settingPath: `${string}.${string}.${string}`
): Promise<T> {
	const [panelId, categoryId, widgetId] = settingPath.split('.');

	// Wait for any pending setValue operations on this panel
	const existingLock = panelLocks.get(panelId);
	if (existingLock) {
		await existingLock;
	}

	const now = Date.now();
	if (!settingsCache[panelId] || now - settingsCache[panelId].timestamp > CACHE_LIFETIME) {
		const loadedSettings = await loadSettings(panelId);
		if (loadedSettings) {
			settingsCache[panelId] = { data: loadedSettings, timestamp: now };
		} else {
			throw new Error(`Failed to load settings for panel '${panelId}'.`);
		}
	}

	const settings = settingsCache[panelId].data;

	if (!settings[categoryId]) {
		throw new Error(`The category '${categoryId}' doesn't exist in panel '${panelId}'.`);
	}

	if (!(widgetId in settings[categoryId])) {
		throw new Error(`The widget '${widgetId}' doesn't exist in category '${categoryId}' of panel '${panelId}'.`);
	}

	return settings[categoryId][widgetId] as T;
}

/** Clean up resources */
export function cleanup(): void {
	if (saveInterval) {
		clearInterval(saveInterval);
		saveInterval = null;
		hasInterval = false;
	}

	// Clear all locks and cache
	panelLocks.clear();
	settingsCache = {};
}
