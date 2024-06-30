import {debug, storage, filesystem, os} from '@neutralinojs/lib';
import {pathExists} from './utils';

export async function dataPath(): Promise<string> {
	return `${await os.getPath('data')}/AppleBlox/.storage`;
}

/** Copies the settings folder to Application Support */
async function copyNeuStorage(panelId: string) {
	const path = await dataPath();
	if (!(await pathExists(path))) {
		await filesystem.createDirectory(path);
	}
	try {
		const filepath = `${path}/${panelId}.neustorage`;
		if (await pathExists(filepath)) {
			await filesystem.remove(filepath);
		}
		await filesystem.copy(`${window.NL_PATH}/.storage/${panelId}.neustorage`, filepath);
	} catch (err) {
		console.error(err);
	}
}

/** Saves the data provided to the Application Support folder */
export async function saveSettings(panelId: string, data: Object): Promise<void> {
	try {
		await storage.setData(panelId, JSON.stringify(data));
		copyNeuStorage(panelId);
	} catch (err) {
		throw err;
	}
}

/** Loads the data from the specified panelID */
export async function loadSettings(panelId: string): Promise<{[key: string]: Object} | undefined> {
	try {
		const filepath = `${await dataPath()}/${panelId}.neustorage`;
		if (!(await pathExists(filepath))) {
			return undefined
		}
		return JSON.parse(await filesystem.readFile(filepath));
	} catch (err) {
		console.error(err)
	}
}
