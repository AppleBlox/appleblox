import { os, filesystem } from '@neutralinojs/lib';
import path from 'path-browserify';
import { pathExists } from '../../ts/utils';

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
			filesystem.writeFile(path, data).catch(console.error);
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
			console.error(err);
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
		console.error(err);
	}
}

/** Set a specific value of a setting */
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
