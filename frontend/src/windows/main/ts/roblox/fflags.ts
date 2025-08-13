import { computer, filesystem } from '@neutralinojs/lib';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import { getAllProfiles, getSelectedProfile, writeProfile, type Profile } from '../../components/flag-editor';
import { getConfigPath, getValue, loadSettings } from '../../components/settings';
import type { SelectElement, SettingsOutput } from '../../components/settings/types';
import { Curl } from '../tools/curl';
import shellFS from '../tools/shellfs';
import { isUrlReachable } from '../utils';
import { getMostRecentRoblox } from './path';

const FLAGS_WHITELIST = ['FFlagDebugGraphicsDisableMetal'];

export type FastFlag = string | boolean | null | number;
export type FFs = { [key: string]: FastFlag };
export interface EditorFlag {
	flag: string;
	enabled: boolean;
	value: string;
}

/** Function used to build the flags list */
async function buildFlagsList(): Promise<FastFlagsList> {
	const flags = new FastFlagsList()
		// GRAPHICS
		// Unlock FPS
		.addFlag({
			name: 'FPS Target',
			flags: { DFIntTaskSchedulerTargetFps: '%s' },
			path: 'fastflags.graphics.fps_target',
			type: 'slider',
			value: async (s) => ((s as number[])[0] !== 60) && (await getValue<SelectElement>('fastflags.graphics.engine')).value === 'vulkan',
		})
		// Graphics API
		.addFlag({
			name: 'Graphics API (OpenGL)',
			flags: {
				FFlagDebugGraphicsDisableMetal: true,
				FFlagDebugGraphicsPreferOpenGL: true,
			},
			path: 'fastflags.graphics.engine',
			type: 'select',
			value: 'opengl',
		})
		.addFlag({
			name: 'Graphics API (Metal)',
			flags: { FFlagDebugGraphicsPreferMetal: true },
			path: 'fastflags.graphics.engine',
			type: 'select',
			value: 'metal',
		})
		.addFlag({
			name: 'Graphics API (Vulkan)',
			flags: { FFlagDebugGraphicsPreferVulkan: true, FFlagDebugGraphicsDisableMetal: true },
			path: 'fastflags.graphics.engine',
			type: 'select',
			value: 'vulkan',
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
			name: 'Graphics Quality',
			flags: { DFIntDebugFRMQualityLevelOverride: '%s' },
			path: 'fastflags.graphics.quality_distance',
			type: 'slider',
			value: async (settingValue) =>
				settingValue === true && (await getValue<boolean>('fastflags.graphics.quality_distance_toggle')) === true,
		})
		// PostFX
		.addFlag({
			name: 'Visual Effects',
			flags: { FFlagDisablePostFx: true },
			path: 'fastflags.graphics.postfx',
			type: 'switch',
			value: false,
		})
		// Level-of-detail
		.addFlag({
			name: 'Level-of-detail',
			flags: {
				DFIntCSGLevelOfDetailSwitchingDistance: 0,
				DFIntCSGLevelOfDetailSwitchingDistanceL12: 0,
			},
			path: 'fastflags.graphics.lod',
			type: 'switch',
			value: true,
		})
		// Fractional Scaling Fix
		.addFlag({
			name: 'Fractional Scaling',
			flags: { DFFlagDisableDPIScale: true },
			path: 'fastflags.graphics.fracscaling',
			type: 'switch',
			value: true,
		})
		// VISUAL
		// Player textures
		.addFlag({
			name: 'Player textures',
			flags: { DFIntTextureCompositorActiveJobs: 0 },
			path: 'fastflags.visual.player_textures',
			type: 'switch',
			value: false,
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
			name: 'Menu version (Version 2)',
			flags: {
				/* v2 */ FFlagDisableNewIGMinDUA: false,
				FFlagEnableInGameMenuModernization: false,
				/* Chrome */ FFlagEnableInGameMenuChrome: false,
				FFlagFixReportButtonCutOff: false,
				FIntNewInGameMenuPercentRollout3: 100,
				FFlagEnableInGameMenuChromeABTest4: false,
			},
			path: 'fastflags.ui.menu_version',
			type: 'select',
			value: 'v2',
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
	return flags;
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
		| ((settingValue: string | number | boolean | number[] | { label: string; value: string }) => Promise<boolean>);
	/** The flags added if the setting === the value */
	flags: FFs;
}

export class RobloxFFlags {
	static async parseFlags(preset = false): Promise<{
		validFlags: FFs;
		invalidFlags: string[];
		nameMap: string[];
		invalidProfileFlags?: { name: string; flags: FFs }[];
	}> {
		console.info(`[FastFlags] Starting flag parsing process. Mode: ${preset ? 'Preset' : 'Custom'}`);

		// Get the path to Application Support
		const configPath = await getConfigPath();
		console.info(`[FastFlags] Config path resolved to: ${configPath}`);

		let flagsList = new FastFlagsList();

		// If the function needs to parse the presets
		if (preset) {
			console.info('[FastFlags] Building preset flags list...');
			flagsList = await buildFlagsList();
			console.info('[FastFlags] Building preset flags data...');
			const data = await flagsList.build();
			console.info(
				`[FastFlags] Preset parsing complete. Found ${Object.keys(data.validFlags).length} valid flags and ${data.invalidFlags.length} invalid flags.`
			);
			console.debug(data);
			return data;
		}

		// Get selected profile and its flags
		console.info('[FastFlags] Loading user profiles...');
		const allProfiles = await getAllProfiles();
		console.info(`[FastFlags] Found ${allProfiles.length} profiles.`);

		const selectedProfile: Profile | null = await getSelectedProfile(allProfiles);
		console.info(`[FastFlags] Selected profile: ${selectedProfile ? selectedProfile.name : 'None'}`);

		let selectedProfileFlags: FFs = {};
		let invalidSelectedProfileFlags: string[] = [];

		if (selectedProfile) {
			console.info(`[FastFlags] Processing selected profile "${selectedProfile.name}"...`);
			const modifiedFlagsObject: FFs = Object.fromEntries(
				selectedProfile.flags.filter(({ enabled }) => enabled).map(({ flag, value }) => [flag, value])
			);
			console.info(`[FastFlags] Found ${Object.keys(modifiedFlagsObject).length} enabled flags in selected profile.`);

			console.info('[FastFlags] Validating profile flags...');
			const { validFlags, invalidFlags } = await flagsList.validateBatch(modifiedFlagsObject);
			console.info(
				`[FastFlags] Validation complete. Valid flags: ${Object.keys(validFlags).length}, Invalid flags: ${Object.keys(invalidFlags).length}`
			);

			selectedProfileFlags = validFlags;
			invalidSelectedProfileFlags = Object.keys(invalidFlags);

			if (invalidSelectedProfileFlags.length > 0) {
				console.warn('[FastFlags] Found invalid flags in selected profile:', invalidSelectedProfileFlags);
			}
		}

		console.info('[FastFlags] Processing game-specific profiles...');
		// Get games profiles and their flags
		let gameFlags: FFs = {};
		let invalidProfileFlags: { name: string; flags: FFs }[] = [];
		const profilesPath = path.join(configPath, 'profiles');

		console.info(`[FastFlags] Reading profiles from: ${profilesPath}`);
		const entries = (await filesystem.readDirectory(profilesPath, { recursive: false })).filter((entry) =>
			entry.path.endsWith('.json')
		);
		console.info(`[FastFlags] Found ${entries.length} profile files.`);

		for (const entry of entries) {
			console.info(`[FastFlags] Processing profile from ${entry.path}...`);
			const data: Profile = JSON.parse(await filesystem.readFile(entry.path));

			if (!(data.type && data.games && typeof data.games === 'object')) {
				console.warn(
					`[FastFlags] Invalid profile at ${entry.path}. Profile must have type, games array, and valid flag configurations.`
				);
				continue;
			}
			if (data.type === 'default') {
				console.info('[FastFlags] Skipping default profile type.');
				continue;
			}

			console.info(`[FastFlags] Processing profile "${data.name}" with ${data.flags.length} flags...`);
			const modifiedFlagsObject: FFs = Object.fromEntries(
				data.flags.filter(({ enabled }) => enabled).map(({ flag, value }) => [flag, value])
			);
			console.info(`[FastFlags] Found ${Object.keys(modifiedFlagsObject).length} enabled flags in profile.`);

			console.info('[FastFlags] Validating profile flags...');
			const { validFlags, invalidFlags } = await flagsList.validateBatch(modifiedFlagsObject);
			console.info(
				`[FastFlags] Validation complete. Valid flags: ${Object.keys(validFlags).length}, Invalid flags: ${Object.keys(invalidFlags).length}`
			);

			if (Object.keys(invalidFlags).length > 0) {
				console.warn(
					`[FastFlags] Found ${Object.keys(invalidFlags).length} invalid flags in profile "${data.name}":`,
					Object.keys(invalidFlags)
				);
				invalidProfileFlags.push({ name: data.name, flags: invalidFlags });
			}

			console.info(`[FastFlags] Adding place filters for ${Object.keys(validFlags).length} flags...`);
			// For each flag, append the placeFilter of the games
			for (const [flag, value] of Object.entries(validFlags)) {
				if (flag.endsWith('_PlaceFilter')) {
					console.info(`[FastFlags] Skipping existing place filter: ${flag}`);
					continue;
				}
				gameFlags[`${flag}_PlaceFilter`] = `${value};${data.games.join(';')}`;
				console.info(`[FastFlags] Added place filter for ${flag} with ${data.games.length} games.`);
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
		console.info('[FastFlags] Starting ClientAppSettings write process...');
		const filePath = path.join(await getMostRecentRoblox(), 'Contents/MacOS/ClientSettings/ClientAppSettings.json');

		if (await shellFS.exists(filePath)) {
			console.info('[FastFlags] Removing existing ClientAppSettings file...');
			await filesystem.remove(filePath);
			console.info('[FastFlags] Successfully removed existing ClientAppSettings file.');
		}

		await filesystem.createDirectory(path.dirname(filePath));

		console.info('[FastFlags] Parsing preset and custom flags...');
		const [presetFlags, customFlags] = await Promise.all([RobloxFFlags.parseFlags(true), RobloxFFlags.parseFlags(false)]);

		const fflags = {
			...presetFlags.validFlags,
			...customFlags.validFlags,
		};

		console.info('[FastFlags] Writing combined flags to ClientAppSettings...');
		console.info(`[FastFlags] Total flags to write: ${Object.keys(fflags).length}`);
		await filesystem.writeFile(filePath, JSON.stringify(fflags));
		console.info('[FastFlags] Successfully wrote flags to ClientAppSettings.');
		toast.success(`Wrote ClientAppSettings at "${filePath}"`);
	}

	/** Remove the provided flags from all profiles */
	static async removeFlagsFromConfig(flags: string[]) {
		const profiles = await getAllProfiles();

		const updatePromises = profiles.map(async (profile) => {
			const filteredFlags = profile.flags.filter((flag) => !flags.includes(flag.flag));
			await writeProfile(profile.name, { flags: filteredFlags });
		});

		await Promise.all(updatePromises);

		toast.success(`Removed ${flags.length} flag${flags.length !== 1 ? 's' : ''} from all profiles`);
	}
}

export class FastFlagsList {
	private toParseFlags: AddFlagOpts[] = [];
	private skipPanels: string[] = [];
	private settings: { [key: string]: SettingsOutput } = {};
	private validFlagsCache: Set<string> | null = null;

	public addFlag(opts: AddFlagOpts) {
		this.toParseFlags.push(opts);
		return this;
	}

	private async validateFlags(flags: string[]): Promise<Set<string>> {
		if (!flags.length) return new Set();

		const isReachable = await isUrlReachable('https://flagsman.appleblox.com', 3000);
		if (!isReachable) {
			console.warn(
				'[FastFlags] Flagsman API (https://flagsman.appleblox.com) is unreachable. Skipping validation and treating all flags as valid. This may cause issues if invalid flags are used.'
			);
			return new Set(flags);
		}

		try {
			const req = await Curl.post(
				'https://flagsman.appleblox.com/api/check',
				{
					flags,
					applications: [
						'PCDesktopClient',
						'MacDesktopClient',
						'XboxClient',
						'iOSApp',
						'UWPApp',
						'AndroidApp',
						'PCStudioApp',
						'MacStudioApp',
					],
				},
				{ headers: { 'Content-Type': 'application/json' } }
			);

			if (!req.body) {
				throw new Error(
					'[FastFlags] Flagsman API response body was empty. This could indicate a network issue or API malfunction.'
				);
			}

			const res = JSON.parse(req.body);
			if (res.error) {
				throw new Error(
					`[FastFlags] Flagsman API returned error: ${res.error}. Please check your flag configurations and try again.`
				);
			}

			return new Set([...res.valid, ...FLAGS_WHITELIST]);
		} catch (error) {
			console.error('[FastFlags] Failed to validate flags through Flagsman API:', error);
			console.error('[FastFlags] Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
			console.error('[FastFlags] Attempted to validate flags:', flags);
			return new Set();
		}
	}

	public async validateBatch(flags: FFs): Promise<{ validFlags: FFs; invalidFlags: FFs }> {
		const validatedFlags = await this.validateFlags(Object.keys(flags));

		const validFlags: FFs = {};
		const invalidFlags: FFs = {};

		for (const [flag, value] of Object.entries(flags)) {
			if (validatedFlags.has(flag)) {
				validFlags[flag] = value;
			} else {
				invalidFlags[flag] = value;
			}
		}

		return { validFlags, invalidFlags };
	}

	private async getSettingValue(opts: AddFlagOpts): Promise<boolean> {
		const [panelId, categoryId, widgetId] = opts.path.split('.');

		if (this.skipPanels.includes(panelId)) return false;

		if (!this.settings[panelId]) {
			this.settings[panelId] = (await loadSettings(panelId)) || {};

			if (Object.keys(this.settings[panelId]).length < 1) {
				this.skipPanels.push(panelId);
				console.warn(
					`[FastFlags] Panel "${panelId}" is empty. All associated flags will be skipped. This might indicate a configuration issue or missing settings.`
				);
				return false;
			}
		}

		const settings = this.settings[panelId];
		if (!settings[categoryId]) {
			console.warn(`The category "${categoryId}" in the panel "${panelId}" doesn't exist. Skipping.`);
			return false;
		}

		const settingValue = settings[categoryId][widgetId];
		if (settingValue == null) {
			console.warn(`The setting "${opts.path}" doesn't exist. Skipping.`);
			return false;
		}

		if (typeof opts.value === 'function') {
			return opts.value(settingValue).catch((err) => {
				console.error('[FastFlags] Error while calling flags value callback:', err);
				return false;
			});
		}

		if (opts.type === 'always') return true;

		switch (opts.type) {
			case 'switch':
			case 'input':
			case 'slider':
				return settingValue === opts.value;
			case 'select':
				return (settingValue as { value: string }).value === opts.value;
			default:
				return false;
		}
	}

	private processValue(value: FastFlag, settingValue: any, type: string): FastFlag {
		if (typeof value !== 'string') return value;

		let svalue = '';
		switch (type) {
			case 'input':
			case 'switch':
				svalue = (settingValue || '').toString();
				break;
			case 'select':
				svalue = (settingValue as { value: string }).value.toString();
				break;
			case 'slider':
				svalue = (settingValue as number[])[0].toString();
				break;
		}

		return value.replaceAll('%s', svalue);
	}

	public async build(): Promise<{
		validFlags: FFs;
		invalidFlags: string[];
		nameMap: string[];
	}> {
		// Collect all flags first
		const allFlags = new Set<string>();
		this.toParseFlags.forEach((opt) => {
			Object.keys(opt.flags).forEach((flag) => allFlags.add(flag));
		});

		// Validate all flags in a single API call
		this.validFlagsCache = await this.validateFlags([...allFlags]);

		const validFlags: FFs = {};
		const invalidFlags: string[] = [];
		const nameMap: string[] = [];

		for (const opts of this.toParseFlags) {
			const shouldAddFlags = await this.getSettingValue(opts);
			if (!shouldAddFlags) continue;

			let hasInvalidFlag = false;
			for (const [flag, value] of Object.entries(opts.flags)) {
				if (!this.validFlagsCache.has(flag)) {
					invalidFlags.push(flag);
					hasInvalidFlag = true;
					continue;
				}

				const settingValue = this.settings[opts.path.split('.')[0]]?.[opts.path.split('.')[1]]?.[opts.path.split('.')[2]];
				const processedValue = this.processValue(value, settingValue, opts.type);
				validFlags[flag] = processedValue;
			}

			if (hasInvalidFlag) {
				nameMap.push(opts.name);
			}
		}

		return { validFlags, invalidFlags, nameMap };
	}
}
