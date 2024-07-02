import { os, filesystem } from "@neutralinojs/lib";
import { pathExists } from "./utils";
import path from "path-browserify";
import type { FFlag } from "@/types/settings";
import { dataPath } from "./settings";

/** Returns every saved FFlags */
export async function getFlags(): Promise<FFlag[] | undefined> {
	// Read the saved fflags file inside Application Support
	const filePath = path.join(await dataPath(),"fflags.json");
	if (!(await pathExists(filePath))) {
		await setFlags([]);
	}
	const fileContent = await filesystem.readFile(filePath);
	try {
		return JSON.parse(fileContent);
	} catch (error) {
		// There was no flags previously saved or there's a random error
		return undefined;
	}
}

/** Saves and backup fflags */
export async function setFlags(flags: FFlag[]) {
	const configPath = await dataPath();
	const filePath = path.join(configPath, "fflags.json");
	// Check if the AppleBlox/config dir exsits
	if (!(await pathExists(configPath))) {
		await filesystem.createDirectory(configPath);
	}
	// If file exits then we remove it
	if (await pathExists(filePath)) {
		await filesystem.remove(filePath);
	}
	// Copy the new file to Application Support
	await filesystem.writeFile(filePath, JSON.stringify(flags));
}

/** Sets a fflag to true or false */
export async function setFlag(flag: string, enabled: boolean, value: string) {
	const configPath = await dataPath()
	const filePath = path.join(configPath, "fflags.json");
	// Check if the AppleBlox/config dir exsits
	if (!(await pathExists(configPath))) {
		await filesystem.createDirectory(configPath);
	}

	// Load the fflags from the saved file || empty array
	let fflags: FFlag[] = JSON.parse(await filesystem.readFile(filePath)) || [];
	// Modify the flag if it exists or create a new one
	if (fflags.find((f) => f.flag === flag)) {
		fflags[fflags.findIndex((f) => f.flag === flag)] = { flag, enabled, value };
	} else {
		fflags.push({ flag, enabled, value });
	}
	await setFlags(fflags);
}

/** Append a flag to the config file. If the one provided already exists, then this will return false */
export async function addFlag(flag: string, value: string): Promise<boolean> {
	let flags: FFlag[] = (await getFlags()) || [];
	if (flags.find((f) => f.flag === flag)) {
		// The flag already exists
		return false;
	} else {
		flags.push({ flag, enabled: true, value });
		await setFlags(flags);
		return true;
	}
}

/** Removes the provided flag. If it's doesn't exist, returns false */
export async function removeFlag(flag: string): Promise<boolean> {
	let flags: FFlag[] = (await getFlags()) || [];
	if (flags.find((f) => f.flag === flag)) {
		await setFlags(flags.filter((f) => f.flag !== flag));
		return true;
	} else {
		// The flag doesn't exist
		return false;
	}
}
