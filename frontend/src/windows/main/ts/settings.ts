import { filesystem, os } from "@neutralinojs/lib";
import { pathExists } from "./utils";
import path from "path-browserify";

export async function dataPath(): Promise<string> {
	return path.join(await os.getPath("data"), "AppleBlox", "config");
}

/** Saves the data provided to the Application Support folder */
let saveQueue: { panelId: string; data: string }[] = [];
let hasInterval = false;
if (!hasInterval) {
	hasInterval = true;
	setInterval(async () => {
		const savePath = await dataPath();
		// Create the directory if it doesn't exist
		await os.execCommand(`mkdir -p "${savePath}"`);
		for (const { panelId, data } of saveQueue) {
			const filePath = path.join(savePath, panelId + ".json");
			await os.execCommand(`rm -f "${filePath}"`);
			await filesystem.writeFile(filePath, data).catch(console.error);
			saveQueue = saveQueue.filter((q) => q.panelId !== panelId);
		}
	}, 100);
}

/** Saves the settings of a panel by its ID. Can only save a panel once every 100ms */
export async function saveSettings(panelId: string, data: Object): Promise<void> {
	saveQueue.push({ panelId, data: JSON.stringify(data) });
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
