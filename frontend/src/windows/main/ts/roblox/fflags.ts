import { filesystem } from '@neutralinojs/lib';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import Roblox from '.';
import { getAllProfiles, getSelectedProfile, type Profile } from '../../components/flag-editor';
import { getConfigPath, getValue, loadSettings } from '../../components/settings';
import type { SelectElement, SettingsOutput } from '../../components/settings/types';
import shellFS from '../tools/shellfs';
import { showNotification } from '../tools/notifications';

export type FastFlag = string | boolean | null | number;
export type FFs = { [key: string]: FastFlag };
export interface EditorFlag {
	flag: string;
	enabled: boolean;
	value: string;
}

/** Function used to build the flags list */
async function buildFlagsList(): Promise<FastFlagsList> {
	let data = {
		forceVulkan: ((await getValue<number[]>('fastflags.graphics.fps_target'))[0] || 60) > 60,
	};
	const flags = new FastFlagsList()
		// GRAPHICS
		// FPS Target
		.addFlag({
			name: 'FPS Target',
			flags: { DFIntTaskSchedulerTargetFps: '%s' },
			path: 'fastflags.graphics.fps_target',
			type: 'slider',
		})
		// Rendering Engine
		.addFlag({
			name: 'Rendering Engine (OpenGL)',
			flags: {
				FFlagDebugGraphicsDisableMetal: true,
				FFlagDebugGraphicsPreferOpenGL: true,
			},
			path: 'fastflags.graphics.engine',
			type: 'select',
			value: async (s) => !data.forceVulkan && (s as SelectElement).value === 'opengl',
		})
		.addFlag({
			name: 'Rendering Engine (Metal)',
			flags: { FFlagDebugGraphicsPreferMetal: true },
			path: 'fastflags.graphics.engine',
			type: 'select',
			value: async (s) => !data.forceVulkan && (s as SelectElement).value === 'metal',
		})
		.addFlag({
			name: 'Rendering Engine (Vulkan)',
			flags: { FFlagDebugGraphicsPreferVulkan: true },
			path: 'fastflags.graphics.engine',
			type: 'select',
			value: async (s) => data.forceVulkan || (s as SelectElement).value === 'vulkan',
		})
		// Lightning
		.addFlag({
			name: 'Lightning Technology (Voxel)',
			flags: { DFFlagDebugRenderForceTechnologyVoxel: true },
			path: 'fastflags.graphics.lightning',
			type: 'select',
			value: 'voxel',
		})
		.addFlag({
			name: 'Lightning Technology (Shadowmap)',
			flags: { FFlagDebugForceFutureIsBrightPhase2: true },
			path: 'fastflags.graphics.lightning',
			type: 'select',
			value: 'shadowmap',
		})
		.addFlag({
			name: 'Lightning Technology (Future)',
			flags: { FFlagDebugForceFutureIsBrightPhase3: true },
			path: 'fastflags.graphics.lightning',
			type: 'select',
			value: 'future',
		})
		// Voxel shadow
		.addFlag({
			name: 'Disable Voxel shadows',
			flags: { DFFlagDebugPauseVoxelizer: true },
			path: 'fastflags.graphics.disable_voxel_shadows',
			type: 'switch',
			value: async (settingValue) =>
				settingValue === true && (await getValue<SelectElement>('fastflags.graphics.lightning')).value === 'voxel',
		})
		// Graphics w/ render distance
		.addFlag({
			name: 'Graphics w/ render distance',
			flags: { DFIntDebugFRMQualityLevelOverride: '%s' },
			path: 'fastflags.graphics.quality_distance',
			type: 'slider',
			value: async (settingValue) =>
				settingValue === true && (await getValue<boolean>('fastflags.graphics.quality_distance_toggle')) === true,
		})
		// Terrain grass
		.addFlag({
			name: 'Terrain grass',
			flags: {
				FIntFRMMinGrassDistance: 0,
				FIntFRMMaxGrassDistance: 0,
				FIntRenderGrassDetailStrands: 0,
			},
			path: 'fastflags.graphics.grass',
			type: 'switch',
			value: false,
		})
		// Shadows
		.addFlag({
			name: 'Shadows',
			flags: {
				DFIntCullFactorPixelThresholdShadowMapHighQuality: '2147483647',
				DFIntCullFactorPixelThresholdShadowMapLowQuality: '2147483647',
			},
			path: 'fastflags.graphics.shadows',
			type: 'switch',
			value: false,
		})
		// Player Shadows
		.addFlag({
			name: 'Player shadows',
			flags: { FIntRenderShadowIntensity: 0 },
			path: 'fastflags.graphics.shadows',
			type: 'switch',
			value: false,
		})
		// PostFX
		.addFlag({
			name: 'PostFX',
			flags: { FFlagDisablePostFx: true },
			path: 'fastflags.graphics.postfx',
			type: 'switch',
			value: false,
		})
		// Anti-aliasing
		.addFlag({
			name: 'Anti-aliasing',
			flags: { FIntDebugForceMSAASamples: 0 },
			path: 'fastflags.graphics.antialiasing',
			type: 'switch',
			value: false,
		})
		// Level-of-detail
		.addFlag({
			name: 'Level-of-detail',
			flags: {
				DFIntCSGLevelOfDetailSwitchingDistance: 0,
				DFIntCSGLevelOfDetailSwitchingDistanceL12: 0,
				DFIntCSGLevelOfDetailSwitchingDistanceL23: 0,
				DFIntCSGLevelOfDetailSwitchingDistanceL34: 0,
			},
			path: 'fastflags.graphics.lod',
			type: 'switch',
			value: true,
		})
		// Limit light updates
		.addFlag({
			name: 'Limit light updates',
			flags: { FIntRenderLocalLightUpdatesMax: 1, FIntRenderLocalLightUpdatesMin: 1 },
			path: 'fastflags.graphics.light_updates',
			type: 'switch',
			value: true,
		})
		// VISUAL
		// Textures quality
		.addFlag({
			name: 'Textures quality',
			flags: { DFFlagTextureQualityOverrideEnabled: true, DFIntTextureQualityOverride: '%s' },
			path: 'fastflags.visual.textures_quality',
			type: 'select',
			async value(settingValue) {
				return (settingValue as SelectElement).value !== 'default';
			},
		})
		// Player textures
		.addFlag({
			name: 'Player textures',
			flags: { DFIntTextureCompositorActiveJobs: 0 },
			path: 'fastflags.visual.player_textures',
			type: 'switch',
			value: false,
		})
		// Flat textures
		.addFlag({
			name: 'Flat textures',
			flags: {
				FStringPartTexturePackTablePre2022:
					'{"glass":{"ids":["rbxassetid://7547304948","rbxassetid://7546645118"],"color":[254,254,254,7]}}',
				FStringPartTexturePackTable2022:
					'{"glass":{"ids":["rbxassetid://7547304948","rbxassetid://7546645118"],"color":[254,254,254,7]}}',
				FStringTerrainMaterialTablePre2022: '',
				FStringTerrainMaterialTable2022: '',
			},
			path: 'fastflags.visual.flat_textures',
			type: 'switch',
			value: true,
		})
		// Debug Sky
		.addFlag({
			name: 'Debug Sky',
			flags: { FFlagDebugSkyGray: true },
			path: 'fastflags.visual.debug_sky',
			type: 'switch',
			value: true,
		})
		// UI
		// Menu version
		.addFlag({
			name: 'Menu version (Version 1)',
			flags: {
				/* v2 */ FFlagDisableNewIGMinDUA: true,
				/* v4 */ FFlagEnableInGameMenuControls: false,
				FFlagEnableInGameMenuModernization: false,
				/* ABTest */ FFlagEnableMenuControlsABTest: false,
				FFlagEnableV3MenuABTest3: false,
				FFlagEnableInGameMenuChromeABTest3: false,
				/* Chrome */ FFlagEnableInGameMenuChrome: false,
				FFlagFixReportButtonCutOff: false,
			},
			path: 'fastflags.ui.menu_version',
			type: 'select',
			value: 'v1',
		})
		.addFlag({
			name: 'Menu version (Version 2)',
			flags: {
				/* v2 */ FFlagDisableNewIGMinDUA: false,
				/* v4 */ FFlagEnableInGameMenuControls: false,
				FFlagEnableInGameMenuModernization: false,
				/* ABTest */ FFlagEnableMenuControlsABTest: false,
				FFlagEnableV3MenuABTest3: false,
				FFlagEnableInGameMenuChromeABTest3: false,
				/* Chrome */ FFlagEnableInGameMenuChrome: false,
			},
			path: 'fastflags.ui.menu_version',
			type: 'select',
			value: 'v2',
		})
		.addFlag({
			name: 'Menu version (Version 4)',
			flags: {
				/* v2 */ FFlagDisableNewIGMinDUA: true,
				/* v4 */ FFlagEnableInGameMenuControls: true,
				FFlagEnableInGameMenuModernization: true,
				/* ABTest */ FFlagEnableMenuControlsABTest: false,
				FFlagEnableV3MenuABTest3: false,
				FFlagEnableInGameMenuChromeABTest3: false,
				/* Chrome */ FFlagEnableInGameMenuChrome: false,
			},
			path: 'fastflags.ui.menu_version',
			type: 'select',
			value: 'v4',
		})
		.addFlag({
			name: 'Menu version (Version 4 Chrome)',
			flags: {
				FFlagEnableInGameMenuChrome: true,
				FFlagChromeBetaFeature: true,
			},
			path: 'fastflags.ui.menu_version',
			type: 'select',
			value: 'v4chrome',
		})
		// Font size
		.addFlag({
			name: 'Font size',
			flags: { FIntFontSizePadding: '%s' },
			path: 'fastflags.ui.font_size',
			type: 'slider',
		})
		// UTILITY
		// Hide GUI
		.addFlag({
			name: 'Hide GUI',
			flags: { DFIntCanHideGuiGroupId: 8699949 },
			path: 'fastflags.utility.gui',
			type: 'switch',
			value: true,
		})
		// Disable telemetry
		.addFlag({
			name: 'Disable telemetry',
			flags: {
				FFlagDebugDisableTelemetryEphemeralCounter: true,
				FFlagDebugDisableTelemetryEphemeralStat: true,
				FFlagDebugDisableTelemetryEventIngest: true,
				FFlagDebugDisableTelemetryPoint: true,
				FFlagDebugDisableTelemetryV2Counter: true,
				FFlagDebugDisableTelemetryV2Event: true,
				FFlagDebugDisableTelemetryV2Stat: true,
			},
			path: 'fastflags.utility.telemetry',
			type: 'switch',
			value: true,
		});

	// Actions
	if (data.forceVulkan === true) {
		showNotification({
			title: 'Renderer defaulted to Vulkan',
			content: "Vulkan has been automatically enabled because you set a higher FPS cap than your monitor's refresh rate.",
			timeout: 7,
		});
	}

	return flags;
}

export class RobloxFFlags {
	/** Returns every saved FFlags */
	static async getFlags(): Promise<EditorFlag[] | undefined> {
		// Read the saved fflags file inside Application Support
		const filePath = path.join(await getConfigPath(), 'fflags.json');
		if (!(await shellFS.exists(filePath))) {
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
		if (!(await shellFS.exists(configPath))) {
			await filesystem.createDirectory(configPath);
		}
		// If file exits then we remove it
		if (await shellFS.exists(filePath)) {
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
		if (!(await shellFS.exists(configPath))) {
			await filesystem.createDirectory(configPath);
		}

		// Load the fflags from the saved file || empty array
		const fflags: EditorFlag[] = JSON.parse(await filesystem.readFile(filePath)) || [];
		// Modify the flag if it exists or create a new one
		if (fflags.find((f) => f.flag === flag)) {
			fflags[fflags.findIndex((f) => f.flag === flag)] = {
				flag,
				enabled,
				value,
			};
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

	static async parseFlags(
		preset = false
	): Promise<{ validFlags: FFs; invalidFlags: FFs; nameMap: string[]; invalidProfileFlags?: { name: string; flags: FFs }[] }> {
		// Get the path to Application Supoort
		const configPath = await getConfigPath();
		let flagsList = new FastFlagsList();

		// If the function needs to parse the presets
		if (preset) {
			flagsList = await buildFlagsList();
			const data = await flagsList.build();

			const { validFlags, invalidFlags, nameMap } = data;
			return { validFlags, invalidFlags, nameMap };
		}

		// Get selected profile and its flags
		const allProfiles = await getAllProfiles();
		const selectedProfile: Profile | null = await getSelectedProfile(allProfiles);
		let selectedProfileFlags: FFs = {};
		let invalidSelectedProfileFlags: FFs = {};
		if (selectedProfile) {
			let modifiedFlagsObject: FFs = {};
			for (const { flag, value } of selectedProfile.flags) {
				modifiedFlagsObject[flag] = value;
			}
			selectedProfileFlags = await flagsList.validate(modifiedFlagsObject);
			invalidSelectedProfileFlags = Object.fromEntries(
				Object.entries(modifiedFlagsObject).filter(([key]) => !(key in selectedProfileFlags))
			);
		}

		// Get games profiles and their flags
		let gameFlags: FFs = {};
		// Invalid flags in game profiles
		let invalidProfileFlags: { name: string; flags: FFs }[] = [];
		const profilesPath = path.join(configPath, 'profiles');
		const entries = (await filesystem.readDirectory(profilesPath, { recursive: false })).filter((entry) =>
			entry.path.endsWith('.json')
		);
		for (const entry of entries) {
			const data: Profile = JSON.parse(await filesystem.readFile(entry.path));
			if (!(data.type && data.games && typeof data.games === 'object')) {
				console.warn(`[FastFlags] Invalid profile at ${entry.path}`);
				continue;
			}
			if (data.type === 'default') continue;

			let modifiedFlagsObject: FFs = {};
			for (const flag of data.flags) {
				if (!flag.enabled) continue;
				modifiedFlagsObject[flag.flag] = flag.value;
			}
			const validFlags = await flagsList.validate(modifiedFlagsObject);
			const invalidFlags = Object.fromEntries(Object.entries(modifiedFlagsObject).filter(([key]) => !(key in validFlags)));
			if (Object.keys(invalidFlags).length > 0) {
				invalidProfileFlags.push({ name: data.name, flags: invalidFlags });
			}

			// For each flag, append the placeFilter of the games
			for (const [flag, value] of Object.entries(validFlags)) {
				// If it has already a filter, skip.
				if (flag.endsWith('_PlaceFilter')) continue;
				gameFlags[`${flag}_PlaceFilter`] = `${value};${data.games.join(';')}`;
			}
		}

		return {
			validFlags: { ...selectedProfileFlags, ...gameFlags },
			invalidFlags: invalidSelectedProfileFlags,
			nameMap: [],
			invalidProfileFlags,
		};
	}
	static async writeClientAppSettings() {
		const filePath = path.join(Roblox.path, 'Contents/MacOS/ClientSettings/ClientAppSettings.json');
		if (await shellFS.exists(filePath)) {
			await filesystem.remove(filePath);
		}
		await filesystem.createDirectory(path.dirname(filePath));
		const fflags = {
			...(await RobloxFFlags.parseFlags(true)).validFlags,
			...(await RobloxFFlags.parseFlags(false)).validFlags,
		};
		await filesystem.writeFile(filePath, JSON.stringify(fflags));
		toast.success(`Wrote ClientAppSettings at "${filePath}"`);
	}
}

interface AddFlagOpts {
	/** The path in 'panel.category.setting' to the setting */
	path: `${string}.${string}.${string}`;
	/** Name to display if needed */
	name: string;
	/** The type of the setting */
	type: 'switch' | 'slider' | 'select' | 'input' | 'always';
	/** The value it should be for the flag to be added */
	value?:
		| string
		| boolean
		| number[]
		| null
		| ((settingValue: string | number | boolean | [number] | { label: string; value: string }) => Promise<boolean>);
	/** The flags added if the setting === the value */
	flags: FFs;
}

export class FastFlagsList {
	/** List of all flags to parse and verify */
	private toParseFlags: AddFlagOpts[];
	/** Panels that are empty and need to be skipped */
	private skipPanels: string[];
	/** All cached settings panels */
	private settings: { [key: string]: SettingsOutput };
	/** Cache of flag tracker GitHub repository and other links */
	private trackerCache: {
		windows: string[] | null;
		mac: string[] | null;
		client: string[] | null;
	};

	constructor() {
		this.toParseFlags = [];
		this.skipPanels = [];
		this.settings = {};
		this.trackerCache = { windows: null, mac: null, client: null };
	}

	/** Fetch the FastFlags Tracker list */
	private async fetchTracker() {
		if (!this.trackerCache.mac) {
			await fetch('https://raw.githubusercontent.com/MaximumADHD/Roblox-FFlag-Tracker/main/MacDesktopClient.json')
				.then(async (res) => {
					const flags = Object.keys(await res.json());
					this.trackerCache.mac = flags.length > 0 ? flags : null;
				})
				.catch((err) => {
					console.warn(err);
					this.trackerCache.mac = null;
				});
		}
		if (!this.trackerCache.windows) {
			await fetch('https://raw.githubusercontent.com/MaximumADHD/Roblox-FFlag-Tracker/main/PCDesktopClient.json')
				.then(async (res) => {
					const flags = Object.keys(await res.json());
					this.trackerCache.windows = flags.length > 0 ? flags : null;
				})
				.catch((err) => {
					console.warn(err);
					this.trackerCache.windows = null;
				});
		}
		if (!this.trackerCache.client) {
			await fetch('https://raw.githubusercontent.com/MaximumADHD/Roblox-Client-Tracker/roblox/FVariables.txt')
				.then(async (res) => {
					const input = await res.text();
					const lines = input.split('\n');
					const flagRegex = /\[(?:C\+\+|Lua)\]\s+(\w+)/;

					const flags = lines
						.map((line) => {
							const match = line.match(flagRegex);
							return match ? match[1] : null;
						})
						.filter((flag): flag is string => flag !== null);

					this.trackerCache.client = flags.length > 0 ? flags : null;
				})
				.catch((err) => {
					console.warn(err);
					this.trackerCache.client = null;
				});
		}
	}

	/** Add a flag to the Roblox app based on conditions */
	public addFlag(opts: AddFlagOpts) {
		this.toParseFlags.push(opts);
		return this;
	}

	/** Parse all flags added via addFlag() and returns them */
	public async build(): Promise<{
		validFlags: FFs;
		invalidFlags: FFs;
		/** A list of all the invalid option names */
		nameMap: string[];
	}> {
		let invalidFlags: FFs = {};
		let validFlags: FFs = {};
		let nameMap = [];
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
			if (settingValue == null) {
				console.warn(`The setting "${opts.path}" doesn't exist. Skipping.`);
				continue;
			}
			let addFlag = false;
			if (typeof opts.value === 'function') {
				addFlag = await opts.value(settingValue).catch((err) => {
					console.error('[FastFlags] Error while calling flags value callback: ', err);
					return false;
				});
			} else {
				switch (opts.type) {
					case 'switch':
					case 'input':
					case 'slider':
						addFlag = settingValue === opts.value;
						break;
					case 'select':
						addFlag = (settingValue as { label: string; value: string }).value === opts.value;
						break;
					case 'always':
						addFlag = true;
						break;
				}
			}

			if (!addFlag && opts.value != null) continue;

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
			// True if atleast one flag is added
			let containsInvalidFlags = false;
			for (const [flag, value] of Object.entries(opts.flags)) {
				if (!Object.keys(await this.validate({ [flag]: value })).includes(flag)) {
					console.warn(`The flag "${flag}" is invalid. Skipping.`);
					invalidFlags[flag] = value;
					containsInvalidFlags = true;
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
				validFlags[flag] = filledValue;
			}
			// Add name to invalid option names list
			if (containsInvalidFlags) nameMap.push(opts.name);
		}

		return { validFlags: validFlags, invalidFlags, nameMap };
	}

	/** Validate given flags and returns the correct ones */
	public async validate(flags: FFs): Promise<FFs> {
		await this.fetchTracker();
		const validFlags = Object.entries(flags).filter((flag) => {
			const flagName = flag[0].replace(/_PlaceFilter$/, '');
			return (
				this.trackerCache.mac?.includes(flagName) ||
				this.trackerCache.windows?.includes(flagName) ||
				this.trackerCache.client?.includes(flagName)
			);
		});
		let result: FFs = {};
		for (const validFlag of validFlags) {
			result[validFlag[0]] = validFlag[1];
		}
		return result;
	}
}
