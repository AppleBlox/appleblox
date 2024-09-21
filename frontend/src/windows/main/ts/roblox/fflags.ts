import { filesystem } from '@neutralinojs/lib';
import path from 'path-browserify';
import { getConfigPath, loadSettings } from '../../components/settings';
import { curlGet, pathExists } from '../utils';
import { toast } from 'svelte-sonner';
import type { SettingsOutput } from '../../components/settings';
import Roblox from '.';

type FastFlag = string | boolean | null | number;
type FFs = { [key: string]: FastFlag };
export interface EditorFlag {
	flag: string;
	enabled: boolean;
	value: string;
}

export class RobloxFFlags {
	/** Returns every saved FFlags */
	static async getFlags(): Promise<EditorFlag[] | undefined> {
		// Read the saved fflags file inside Application Support
		const filePath = path.join(await getConfigPath(), 'fflags.json');
		if (!(await pathExists(filePath))) {
			await RobloxFFlags.setFlags([]);
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
	static async setFlags(flags: EditorFlag[]) {
		const configPath = await getConfigPath();
		const filePath = path.join(configPath, 'fflags.json');
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
	static async setFlag(flag: string, enabled: boolean, value: string) {
		const configPath = await getConfigPath();
		const filePath = path.join(configPath, 'fflags.json');
		// Check if the AppleBlox/config dir exsits
		if (!(await pathExists(configPath))) {
			await filesystem.createDirectory(configPath);
		}

		// Load the fflags from the saved file || empty array
		const fflags: EditorFlag[] = JSON.parse(await filesystem.readFile(filePath)) || [];
		// Modify the flag if it exists or create a new one
		if (fflags.find((f) => f.flag === flag)) {
			fflags[fflags.findIndex((f) => f.flag === flag)] = { flag, enabled, value };
		} else {
			fflags.push({ flag, enabled, value });
		}
		await RobloxFFlags.setFlags(fflags);
	}

	/** Append a flag to the config file. If the one provided already exists, then this will return false */
	static async addFlag(flag: string, value: string): Promise<boolean> {
		const flags: EditorFlag[] = (await RobloxFFlags.getFlags()) || [];
		if (flags.find((f) => f.flag === flag)) {
			// The flag already exists
			return false;
		}
		flags.push({ flag, enabled: true, value });
		await RobloxFFlags.setFlags(flags);
		return true;
	}

	/** Removes the provided flag. If it's doesn't exist, returns false */
	static async removeFlag(flag: string): Promise<boolean> {
		const flags: EditorFlag[] = (await RobloxFFlags.getFlags()) || [];
		if (flags.find((f) => f.flag === flag)) {
			await RobloxFFlags.setFlags(flags.filter((f) => f.flag !== flag));
			return true;
		}
		// The flag doesn't exist
		return false;
	}

	static async parseFlags(preset = false): Promise<Object> {
		// Get the path to Application Supoort
		const configPath = await getConfigPath();
		const fflagsJson: FFs = {};

		if (preset) {
			const FlagsList = new FastFlagsList().build();
		}

		if (!(await pathExists(path.join(configPath, 'fflags.json')))) {
			return {};
		}
		const neuPath = path.join(configPath, 'fflags.json');
		const skibidiOhioFanumTax: { flag: string; enabled: boolean; value: string | number }[] = JSON.parse(
			await filesystem.readFile(neuPath)
		);
		for (const flag of skibidiOhioFanumTax) {
			if (flag.enabled) {
				fflagsJson[flag.flag] = flag.value;
			}
		}
		return fflagsJson;
	}
	static async writeClientAppSettings() {
		const filePath = path.join(Roblox.path, 'Contents/MacOS/ClientSettings/AppClientSettings.json');
		if (await pathExists(filePath)) {
			await filesystem.remove(filePath);
		}
		await filesystem.createDirectory(path.dirname(filePath));
		const fflags = {
			...(await RobloxFFlags.parseFlags(false)),
			...(await RobloxFFlags.parseFlags(true)),
		};
		await filesystem.writeFile(filePath, JSON.stringify(fflags));
		toast.success(`Wrote ClientAppSettings at "${filePath}"`);
	}
}

interface AddFlagOpts {
	/** The path in 'panel.category.setting' to the setting */
	path: `${string}.${string}.${string}`;
	/** The type of the setting */
	type: 'switch' | 'slider' | 'select' | 'input' | 'always';
	/** The value it should be for the flag to be added */
	value?: string | boolean | number[] | null;
	/** The flags added if the setting === the value */
	flags: FFs;
}

export class FastFlagsList {
	/** List of accepted flags */
	private flags: FFs;
	/** List of all flags to parse and verify */
	private toParseFlags: AddFlagOpts[];
	/** Panels that are empty and need to be skipped */
	private skipPanels: string[];
	/** All cached settings panels */
	private settings: { [key: string]: SettingsOutput };
	/** Cache of flag tracker GitHub repository */
	private trackerCache: { windows: string[] | null; mac: string[] | null };

	constructor() {
		this.flags = {};
		this.toParseFlags = [];
		this.skipPanels = [];
		this.settings = {};
		this.trackerCache = { windows: null, mac: null };
	}

	/** Fetch the FastFlags Tracker list */
	private async fetchTracker() {
		if (!this.trackerCache.mac) {
			await curlGet('https://raw.githubusercontent.com/MaximumADHD/Roblox-FFlag-Tracker/main/MacDesktopClient.json')
				.then((res) => {
					const flags = Object.keys(res as FFs);
					this.trackerCache.mac = flags.length > 0 ? flags : null;
				})
				.catch((err) => {
					console.warn(err);
					this.trackerCache.mac = null;
				});
		}
		if (!this.trackerCache.windows) {
			await curlGet('https://raw.githubusercontent.com/MaximumADHD/Roblox-FFlag-Tracker/main/PCDesktopClient.json')
				.then((res) => {
					const flags = Object.keys(res as FFs);
					this.trackerCache.windows = flags.length > 0 ? flags : null;
				})
				.catch((err) => {
					console.warn(err);
					this.trackerCache.windows = null;
				});
		}
	}

	/** Add a flag to the Roblox app based on conditions */
	public addFlag(opts: AddFlagOpts) {
		this.toParseFlags.push(opts);
		return this;
	}

	/** Parse all flags added via addFlag() and returns them */
	public async build(): Promise<{ validFlags: FFs; invalidFlags: FFs }> {
		let invalidFlags: FFs = {};
		for (const opts of this.toParseFlags) {
			const [panelId, categoryId, widgetId] = opts.path.split('.');
			// Skip panel because it is empty
			if (this.skipPanels.includes(panelId)) continue;
			// Load settings and cache them
			if (!this.settings[panelId]) {
				this.settings[panelId] = (await loadSettings(panelId)) || {};
			}
			// Skip panel and warn if it has no keys
			if (Object.keys(this.settings[panelId]).length < 1) {
				this.skipPanels.push(panelId);
				console.warn(`Skipping all flags associated with panel "${panelId}" as it is empty.`);
			}
			const settings = this.settings[panelId];
			if (!settings[categoryId]) {
				console.warn(`The category "${categoryId}" in the panel "${panelId}" doesn't exist. Skipping.`);
				continue;
			}
			// Add the flags if the value is the same specified
			const settingValue = settings[categoryId][widgetId];
			let addFlag = false;
			switch (opts.type) {
				case 'switch':
				case 'input':
				case 'slider':
					addFlag = settingValue === opts.value;
					break;
				case 'select':
					addFlag = (settingValue as { label: string; value: string }).value === settingValue;
					break;
				case 'always':
					addFlag = true;
			}
			if (!addFlag && opts.value) continue;

			// Check if the flag is valid from the flag tracker repository
			await this.fetchTracker();

			if (!this.trackerCache.mac) {
				console.warn('Mac flags tracker is empty. Skipping.');
				continue;
			}
			if (!this.trackerCache.windows) {
				console.warn('Windows flags tracker is empty. Skipping.');
				continue;
			}

			// Check if the flags exists and add them with their placeholder
			for (const [flag, value] of Object.entries(opts.flags)) {
				if (!Object.keys(await this.validate({ [flag]: value })).includes(flag)) {
					console.warn(`The flag "${flag}" is invalid. Skipping.`);
					invalidFlags[flag] = value;
					continue;
				}
				// Get the setting value as a correct string format
				let svalue;
				switch (opts.type) {
					case 'input':
					case 'switch':
						svalue = (settingValue || '').toString();
						break;
					case 'select':
						svalue = (settingValue as { label: string; value: string }).value.toString();
						break;
					case 'slider':
						svalue = (settingValue as number[])[0].toString();
						break;
					case 'always':
						svalue = '';
						break;
				}
				svalue;
				const filledValue = typeof value === 'string' ? value.replaceAll('%s', svalue) : value;

				// Add the flag to the list
				this.flags[flag] = filledValue;
			}
		}

		return { validFlags: this.flags, invalidFlags };
	}

	/** Validate given flags and returns the correct ones */
	public async validate(flags: FFs): Promise<FFs> {
		await this.fetchTracker();
		const validFlags = Object.entries(flags).filter(
			(flag) => this.trackerCache.mac?.includes(flag[0]) || this.trackerCache.windows?.includes(flag[0])
		);
		let result: FFs = {};
		for (const validFlag of validFlags) {
			result[validFlag[0]] = validFlag[1];
		}
		return result;
	}
}
