import { filesystem } from '@neutralinojs/lib';
import path from 'path-browserify';
import type { FastFlag } from '../../ts/roblox/fflags';
import shellFS from '../../ts/tools/shellfs';
import { getConfigPath } from '../settings';
import Logger from '@/windows/main/ts/utils/logger';

export interface EditorFlag {
	flag: string;
	enabled: boolean;
	value: FastFlag;
}

export interface Profile {
	name: string;
	type: 'default' | 'game';
	games?: string[];
	flags: EditorFlag[];
}

async function getProfilesConfigPath(): Promise<string> {
	return path.join(await getConfigPath(), 'profiles');
}

/** Turns a string into a lowecase ID and a valid UNIX path */
export function stringToId(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-') // Replace spaces with hyphens
		.replace(/[^a-z0-9-_]/g, '') // Remove any character that's not alphanumeric, hyphen, or underscore
		.replace(/^-+|-+$/g, '') // Remove leading and trailing hyphens
		.replace(/--+/g, '-'); // Replace multiple hyphens with a single hyphen
}

/** Returns true or false whether the JSON respects the profile format */
export function isValidProfile(data: any) {
	return (
		typeof data?.flags === 'object' && typeof data?.name === 'string' && (data?.games ? typeof data.games === 'object' : true)
	);
}

/** Returns the data of a profile */
export async function getProfile(name: string): Promise<Profile | null> {
	const profileId = stringToId(name);
	const profilePath = path.join(await getProfilesConfigPath(), `${profileId}.json`);
	try {
		if (!(await shellFS.exists(profilePath))) {
			return null;
		}
		const profileData: Profile = JSON.parse(await filesystem.readFile(profilePath));
		return profileData;
	} catch (err) {
		throw new Error(`Couldn't get profile: \n${err}`);
	}
}

/** Returns all profiles */
export async function getAllProfiles(): Promise<Profile[]> {
	let profiles: Profile[] = [];
	const profilesPath = await getProfilesConfigPath();
	if (!(await shellFS.exists(profilesPath))) {
		await shellFS.createDirectory(profilesPath);
	}
	const entries = await filesystem.readDirectory(await getProfilesConfigPath());
	for (const file of entries) {
		if (!file.path.endsWith('.json')) continue;
		try {
			const data: Profile = JSON.parse(await filesystem.readFile(file.path));
			// Check if the profile json is valid
			if (!isValidProfile(data)) {
				Logger.warn(`Profile "${path.basename(file.path)}" contains invalid properties. Skipping.`);
				continue;
			}
			profiles.push(data);
		} catch (err) {
			Logger.error(`Couldn't parse profile "${path.basename(file.path)}":`, err);
		}
	}
	return profiles;
}

/** Creates a profile and returns true or false wether the profile could be created */
export async function createProfile(profile: Profile): Promise<boolean> {
	const profileId = stringToId(profile.name);
	const profilePath = path.join(await getProfilesConfigPath(), `${profileId}.json`);
	if (await shellFS.exists(profilePath)) {
		return false;
	}
	try {
		await filesystem.writeFile(profilePath, JSON.stringify(profile));
		return true;
	} catch (err) {
		throw new Error(`Couldn't create profile: \n${err}`);
	}
}

/** Deletes a profile permanently */
export async function deleteProfile(name: string) {
	const profileId = stringToId(name);
	const profilePath = path.join(await getProfilesConfigPath(), `${profileId}.json`);
	if (!(await shellFS.exists(profilePath))) {
		throw Error("Couldn't delete profile, it doesn't exists");
	}
	try {
		await filesystem.remove(profilePath);
	} catch (err) {
		throw new Error(`Couldn't delete profile, filesystem failed:\n ${err}`);
	}
}

interface ProfilesConfig {
	selected: string | null;
}

/** Returns the profiles main config */
async function readConfig(): Promise<ProfilesConfig> {
	try {
		const filePath = path.join(await getConfigPath(), 'profiles.json');
		if (!(await shellFS.exists(filePath))) {
			await filesystem.writeFile(filePath, JSON.stringify({ selected: null } as ProfilesConfig));
		}
		return await JSON.parse(await filesystem.readFile(filePath));
	} catch (err) {
		Logger.error(err);
		return { selected: null };
	}
}

/** Returns the active profile */
export async function getSelectedProfile(profiles: Profile[]): Promise<Profile | null> {
	const config = await readConfig();
	return profiles.find((p) => stringToId(p.name) === config.selected) || profiles[0];
}

/** Set the selected profile */
export async function setSelectedProfile(name: string): Promise<void> {
	let config = await readConfig();
	config.selected = stringToId(name);
	await filesystem.writeFile(path.join(await getConfigPath(), 'profiles.json'), JSON.stringify(config));
}

/** Write data to a profile */
export async function writeProfile(name: string, profile: Partial<Profile>) {
	let p = await getProfile(name); // profile
	if (!p) {
		throw new Error(`Profile "${name}" doesn't exist.`);
	}
	p = { ...p, ...profile };
	const profilePath = path.join(await getProfilesConfigPath(), `${stringToId(name)}.json`);
	await filesystem.writeFile(profilePath, JSON.stringify(p));
}
