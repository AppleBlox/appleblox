import { filesystem } from '@neutralinojs/lib';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import { getAllProfiles, getSelectedProfile, writeProfile, type Profile } from '../../components/flag-editor';
import { getConfigPath } from '../../components/settings';
import shellFS from '../tools/shellfs';
import { getMostRecentRoblox } from './path';
import Logger from '@/windows/main/ts/utils/logger';
import { getValue, loadSettings } from '../../components/settings';

const ALLOWED_FLAGS = [
	// Geometry
	'DFIntCSGLevelOfDetailSwitchingDistance',
	'DFIntCSGLevelOfDetailSwitchingDistanceL12',
	'DFIntCSGLevelOfDetailSwitchingDistanceL23',
	'DFIntCSGLevelOfDetailSwitchingDistanceL34',
	// Rendering
	'FFlagHandleAltEnterFullscreenManually',
	'DFFlagTextureQualityOverrideEnabled',
	'DFIntTextureQualityOverride',
	'FIntDebugForceMSAASamples',
	'DFFlagDisableDPIScale',
	'FFlagDebugGraphicsPreferD3D11',
	'FFlagDebugSkyGray',
	'DFFlagDebugPauseVoxelizer',
	'DFIntDebugFRMQualityLevelOverride',
	'FIntFRMMaxGrassDistance',
	'FIntFRMMinGrassDistance',
	'FFlagDebugGraphicsPreferVulkan',
	'FFlagDebugGraphicsPreferOpenGL',
	'FFlagDebugGraphicsDisableMetal',
	'FFlagDebugGraphicsPreferMetal',
	// User Interface
	'FIntGrassMovementReducedMotionFactor',
];

export type FastFlag = string | boolean | null | number;
export type FFs = { [key: string]: FastFlag };

export interface EditorFlag {
	flag: string;
	enabled: boolean;
	value: FastFlag;
}

async function buildFlagsList(): Promise<FastFlagsList> {
	const flags = new FastFlagsList()
		.addFlag({
			name: 'Graphics API (OpenGL)',
			flags: {
				FFlagDebugGraphicsDisableMetal: true,
				FFlagDebugGraphicsPreferOpenGL: true,
			},
			path: 'engine.graphics.engine',
			type: 'select',
			value: async (settingValue) => {
				return (
					(settingValue as { label: string; value: string }).value === 'opengl' ||
					(await getValue<boolean>('engine.graphics.fps_cap')) === true
				);
			},
		})
		.addFlag({
			name: 'Graphics API (Metal)',
			flags: { FFlagDebugGraphicsPreferMetal: true },
			path: 'engine.graphics.engine',
			type: 'select',
			value: async (settingValue) => {
				return (
					(settingValue as { label: string; value: string }).value === 'metal' &&
					!((await getValue<boolean>('engine.graphics.fps_cap')) === true)
				);
			},
		})
		.addFlag({
			name: 'Graphics API (Vulkan)',
			flags: { FFlagDebugGraphicsPreferVulkan: true, FFlagDebugGraphicsDisableMetal: true },
			path: 'engine.graphics.engine',
			type: 'select',
			value: async (settingValue) => {
				return (
					(settingValue as { label: string; value: string }).value === 'vulkan' &&
					!((await getValue<boolean>('engine.graphics.fps_cap')) === true)
				);
			},
		})
		.addFlag({
			name: 'Graphics Quality',
			flags: { DFIntDebugFRMQualityLevelOverride: '%s' },
			path: 'engine.graphics.quality_distance',
			type: 'slider',
			value: async (settingValue) => {
				return settingValue === true && (await getValue<boolean>('engine.graphics.quality_distance_toggle')) === true;
			},
		})
		.addFlag({
			name: 'Level-of-detail',
			flags: {
				DFIntCSGLevelOfDetailSwitchingDistance: 0,
				DFIntCSGLevelOfDetailSwitchingDistanceL12: 0,
			},
			path: 'engine.graphics.lod',
			type: 'switch',
			value: true,
		})
		.addFlag({
			name: 'Fractional Scaling',
			flags: { DFFlagDisableDPIScale: true },
			path: 'engine.graphics.fracscaling',
			type: 'switch',
			value: true,
		})
		.addFlag({
			name: 'Debug Sky',
			flags: { FFlagDebugSkyGray: true },
			path: 'engine.visual.debug_sky',
			type: 'switch',
			value: true,
		});
	return flags;
}

interface AddFlagOpts {
	path: `${string}.${string}.${string}`;
	name: string;
	type: 'switch' | 'slider' | 'select' | 'input' | 'always';
	value?:
		| string
		| boolean
		| number[]
		| null
		| ((settingValue: string | number | boolean | number[] | { label: string; value: string }) => Promise<boolean>);
	flags: FFs;
}

export class RobloxFFlags {
	static async parseFlags(preset = false): Promise<{
		validFlags: FFs;
		invalidFlags: string[];
		nameMap: string[];
		invalidProfileFlags?: { name: string; flags: FFs }[];
	}> {
		Logger.info(`Starting flag parsing. Mode: ${preset ? 'Preset' : 'Custom'}`);

		let flagsList = new FastFlagsList();

		if (preset) {
			Logger.info('Building preset flags list...');
			flagsList = await buildFlagsList();
			const data = await flagsList.build();
			Logger.info(
				`Preset parsing complete. Valid: ${Object.keys(data.validFlags).length}, Invalid: ${data.invalidFlags.length}`
			);
			return data;
		}

		const allProfiles = await getAllProfiles();
		const selectedProfile = await getSelectedProfile(allProfiles);

		let selectedProfileFlags: FFs = {};
		let invalidSelectedProfileFlags: string[] = [];

		if (selectedProfile) {
			const modifiedFlagsObject: FFs = Object.fromEntries(
				selectedProfile.flags.filter(({ enabled }) => enabled).map(({ flag, value }) => [flag, value])
			);

			const { validFlags, invalidFlags } = await flagsList.validateBatch(modifiedFlagsObject);
			selectedProfileFlags = validFlags;
			invalidSelectedProfileFlags = Object.keys(invalidFlags);
		}

		let gameFlags: FFs = {};
		let invalidProfileFlags: { name: string; flags: FFs }[] = [];
		const profilesPath = path.join(await getConfigPath(), 'profiles');

		const entries = (await filesystem.readDirectory(profilesPath, { recursive: false })).filter((entry) =>
			entry.path.endsWith('.json')
		);

		for (const entry of entries) {
			const data: Profile = JSON.parse(await filesystem.readFile(entry.path));

			if (!(data.type && data.games && typeof data.games === 'object')) {
				Logger.warn(`Invalid profile at ${entry.path}`);
				continue;
			}
			if (data.type === 'default') continue;

			const modifiedFlagsObject: FFs = Object.fromEntries(
				data.flags.filter(({ enabled }) => enabled).map(({ flag, value }) => [flag, value])
			);

			const { validFlags, invalidFlags } = await flagsList.validateBatch(modifiedFlagsObject);

			if (Object.keys(invalidFlags).length > 0) {
				invalidProfileFlags.push({ name: data.name, flags: invalidFlags });
			}

			for (const [flag, value] of Object.entries(validFlags)) {
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
		Logger.info('Writing ClientAppSettings...');
		const filePath = path.join(await getMostRecentRoblox(), 'Contents/MacOS/ClientSettings/ClientAppSettings.json');

		if (await shellFS.exists(filePath)) {
			await filesystem.remove(filePath);
		}

		await filesystem.createDirectory(path.dirname(filePath));

		const [presetFlags, customFlags] = await Promise.all([RobloxFFlags.parseFlags(true), RobloxFFlags.parseFlags(false)]);

		const fflags = {
			...presetFlags.validFlags,
			...customFlags.validFlags,
		};

		await filesystem.writeFile(filePath, JSON.stringify(fflags));
		toast.success(`Wrote ClientAppSettings at "${filePath}"`);
	}

	static async removeFlagsFromConfig(flags: string[]) {
		const profiles = await getAllProfiles();

		await Promise.all(
			profiles.map(async (profile) => {
				const filteredFlags = profile.flags.filter((flag) => !flags.includes(flag.flag));
				await writeProfile(profile.name, { flags: filteredFlags });
			})
		);

		toast.success(`Removed ${flags.length} flag${flags.length !== 1 ? 's' : ''} from all profiles`);
	}
}

class FastFlagsList {
	private toParseFlags: AddFlagOpts[] = [];
	private skipPanels: string[] = [];
	private settings: { [key: string]: any } = {};
	private validFlagsCache: Set<string> | null = null;

	public addFlag(opts: AddFlagOpts) {
		this.toParseFlags.push(opts);
		return this;
	}

	private async validateFlags(flags: string[]): Promise<Set<string>> {
		if (!flags.length) return new Set();
		const allowedSet = new Set(ALLOWED_FLAGS);
		return new Set(flags.filter((flag) => allowedSet.has(flag)));
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
				return false;
			}
		}

		const settings = this.settings[panelId];
		if (!settings[categoryId]) return false;

		const settingValue = settings[categoryId][widgetId];
		if (settingValue == null) return false;

		if (typeof opts.value === 'function') {
			return opts.value(settingValue).catch(() => false);
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
		const allFlags = new Set<string>();
		this.toParseFlags.forEach((opt) => {
			Object.keys(opt.flags).forEach((flag) => allFlags.add(flag));
		});

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
