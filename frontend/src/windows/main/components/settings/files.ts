import { filesystem, os } from '@neutralinojs/lib';
import path from 'path-browserify';
import { pathExists } from '../../ts/utils';
import type { SelectElement, SettingsOutput } from './types';

export async function getConfigPath(): Promise<string> {
	return path.join(await os.getPath('data'), 'AppleBlox', 'config');
}

/** Saves the data provided to the Application Support folder */
const saveQueue: { [key: string]: string } = {};
let hasInterval = false;
if (!hasInterval) {
	hasInterval = true;
	setInterval(() => {
		for (const [path, data] of Object.entries(saveQueue)) {
			filesystem.writeFile(path, data).catch((err) => {
				console.error('[Settings] ', err);
			});
			delete saveQueue[path];
		}
	}, 1000);
}

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
		if (!(await pathExists(savePath))) {
			await filesystem.createDirectory(savePath);
		}
		try {
			const filepath = `${savePath}/${panelId}.json`;
			if (await pathExists(filepath)) {
				await filesystem.remove(filepath);
			}
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
		if (!(await pathExists(filepath))) {
			return undefined;
		}
		return JSON.parse(await filesystem.readFile(filepath));
	} catch (err) {
		console.error('[Settings] ', err);
	}
}

/** Set the value of a setting */
export async function setValue(settingPath: `${string}.${string}.${string}`, value: any, createNew = false) {
	const paths = settingPath.split('.');
	const panelId = paths[0];
	const categoryId = paths[1];
	const widgetId = paths[2];
	let settings = await loadSettings(panelId);
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
	if (!settings[categoryId][widgetId] && !createNew) {
		throw new Error(`The widget '${widgetId}' doesn't exist.`);
	}
	settings[categoryId][widgetId] = value;
	await saveSettings(panelId, settings);
}

interface CacheEntry {
	data: SettingsOutput;
	timestamp: number;
}

let settingsCache: { [key: string]: CacheEntry } = {};

const CACHE_LIFETIME = 10000; // Cache lifetime: 10 seconds

/** Get the value of a setting */
export async function getValue(
	/** Path to the settings in panel.category.widget */
	settingPath: `${string}.${string}.${string}`
): Promise<boolean | number | string | [number] | null | SelectElement | undefined> {
	const [panelId, categoryId, widgetId] = settingPath.split('.');

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

	return settings[categoryId][widgetId];
}
