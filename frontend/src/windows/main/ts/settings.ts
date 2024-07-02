import { debug, filesystem, os } from "@neutralinojs/lib";
import { pathExists } from "./utils";
import path from "path-browserify";

export async function dataPath(): Promise<string> {
	return path.join(await os.getPath("data"),"AppleBlox","config")
}

/** Copies the settings folder to Application Support */
// async function copyNeuStorage(panelId: string) {
// 	const path = await dataPath();
// 	if (!(await pathExists(path))) {
// 		await filesystem.createDirectory(path);
// 	}
// 	try {
// 		const filepath = `${path}/${panelId}.json`;
// 		if (await pathExists(filepath)) {
// 			await filesystem.remove(filepath);
// 		}
// 		await filesystem.copy(`${window.NL_PATH}/.storage/${panelId}.json`, filepath);
// 	} catch (err) {
// 		console.error(err);
// 	}
// }

/** Saves the data provided to the Application Support folder */
let saveQueue: {[key: string]: string} = {}
let hasInterval = false;
if (!hasInterval) {
	hasInterval = true
	setInterval(()=>{
		for (const [path,data] of Object.entries(saveQueue)) {
			filesystem.writeFile(path,data).catch(console.error);
			delete saveQueue[path]
		}
	},1000)
}

export async function saveSettings(panelId: string, data: Object): Promise<void> {
	try {
		const savePath = (await dataPath());
		// const savePath = path.join(await os.getPath("downloads"),"aaa")
		if (!(await pathExists(savePath))) {
			await filesystem.createDirectory(savePath);
		}
		try {
			// const filepath = `${savePath}/${panelId}.json`;
			// if (await pathExists(filepath)) {
			// 	await filesystem.remove(filepath);
			// }
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
		const filepath = `${await dataPath()}/${panelId}.json`;
		if (!(await pathExists(filepath))) {
			return undefined;
		}
		return JSON.parse(await filesystem.readFile(filepath));
	} catch (err) {
		console.error(err);
	}
}
