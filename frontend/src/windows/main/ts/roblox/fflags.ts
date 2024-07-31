import { computer, filesystem } from '@neutralinojs/lib';
import { pathExists } from '../utils';
import path from 'path-browserify';
import type { FFlag } from '@/types/settings';
import { dataPath, loadSettings } from '../settings';
import { showNotification } from '../notifications';

export class RobloxFFlags {
	/** Returns every saved FFlags */
	static async getFlags(): Promise<FFlag[] | undefined> {
		// Read the saved fflags file inside Application Support
		const filePath = path.join(await dataPath(), 'fflags.json');
		if (!(await pathExists(filePath))) {
			await this.setFlags([]);
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
	static async setFlags(flags: FFlag[]) {
		const configPath = await dataPath();
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
		const configPath = await dataPath();
		const filePath = path.join(configPath, 'fflags.json');
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
		await this.setFlags(fflags);
	}

	/** Append a flag to the config file. If the one provided already exists, then this will return false */
	static async addFlag(flag: string, value: string): Promise<boolean> {
		let flags: FFlag[] = (await this.getFlags()) || [];
		if (flags.find((f) => f.flag === flag)) {
			// The flag already exists
			return false;
		} else {
			flags.push({ flag, enabled: true, value });
			await this.setFlags(flags);
			return true;
		}
	}

	/** Removes the provided flag. If it's doesn't exist, returns false */
	static async removeFlag(flag: string): Promise<boolean> {
		let flags: FFlag[] = (await this.getFlags()) || [];
		if (flags.find((f) => f.flag === flag)) {
			await this.setFlags(flags.filter((f) => f.flag !== flag));
			return true;
		} else {
			// The flag doesn't exist
			return false;
		}
	}

	static async parseFlags(preset = false): Promise<Object> {
		// Get the path to Application Supoort
		const appPath = await dataPath();
		let fflagsJson: { [key: string]: string | number | boolean } = {};
		// utility function
		const makeflag = (flags: { [key: string]: number | string | boolean }) => {
			for (const [flag, value] of Object.entries(flags)) {
				fflagsJson[flag] = value;
			}
		};

		if (preset) {
			const categories = await loadSettings('fastflags');
			if (!categories) {
				console.error("Couldn't load the 'fastlfags' settings while parsing FFlags");
				return {};
			}
			// i know this isn't efficient, but i didn't want to re-write the fastlfags saving system.
			// in the future, i may change this to a dynamic system.
			// Graphics
			let forceVulkan = false;
			for (const name of Object.keys(categories.graphics)) {
				const data = categories.graphics[name];
				if (typeof data === 'boolean' && !data) continue;
				switch (name) {
					case 'ff_fps':
						if (categories.graphics.ff_engine.value.value !== 'vulkan') {
							const displays = await computer.getDisplays();
							const refreshRate = displays.reduce((max, current) => (current.refreshRate > max.refreshRate ? current : max)).refreshRate;
							console.log(`Monitor Refresh rate: ${refreshRate}`);
							if (data[0] > refreshRate) {
								forceVulkan = true;
								makeflag({ FFlagDebugGraphicsDisableMetal: true, FFlagDebugGraphicsPreferVulkan: true });
								showNotification({
									title: 'Renderer defaulted to Vulkan',
									content: `Your monitor does not meet the requirements to use Metal at the selected fps cap.`,
									timeout: 10,
								});
							}
						}
						makeflag({ DFIntTaskSchedulerTargetFps: data[0] });
						break;
					case 'ff_lightning':
						switch (data.value.value) {
							case 'voxel':
								makeflag({ DFFlagDebugRenderForceTechnologyVoxel: true });
								break;
							case 'shadowmap':
								makeflag({ FFlagDebugForceFutureIsBrightPhase2: true });
								break;
							case 'future':
								makeflag({ FFlagDebugForceFutureIsBrightPhase3: true });
								break;
						}
						break;
					case 'ff_engine':
						if (forceVulkan) break;
						switch (data.value.value) {
							// don't know if disabling Metal works, need testing. For now it uses OpenGL
							case 'opengl':
								makeflag({ FFlagDebugGraphicsDisableMetal: true, FFlagDebugGraphicsPreferOpenGL: true });
								break;
							case 'metal':
								makeflag({ FFlagDebugGraphicsPreferMetal: true });
								break;
							case 'vulkan':
								makeflag({ FFlagDebugGraphicsDisableMetal: true, FFlagDebugGraphicsPreferVulkan: true });
								break;
						}
						break;
					case 'ff_voxel_shadows':
						makeflag({ DFFlagDebugPauseVoxelizer: true });
						break;
					case 'ff_display':
						if (!categories.graphics.ff_display_toggle) break;
						makeflag({ DFIntDebugFRMQualityLevelOverride: data[0] });
						break;
					case 'ff_graphics':
						makeflag({ FFlagCommitToGraphicsQualityFix: true, FFlagFixGraphicsQuality: true });
						break;
					case 'ff_grass':
						makeflag({ FIntFRMMinGrassDistance: 0, FIntFRMMaxGrassDistance: 0, FIntRenderGrassDetailStrands: 0, FIntRenderGrassHeightScaler: 0 });
						break;
					case 'ff_shadows':
						makeflag({ FIntRenderShadowIntensity: 0 });
						break;
					case 'ff_player_shadows':
						makeflag({ FIntRenderShadowIntensity: 0 });
						break;
					case 'ff_postfx':
						makeflag({ FFlagDisablePostFx: true });
						break;
					case 'ff_antialiasing':
						makeflag({ FIntDebugForceMSAASamples: 0 });
						break;
					case 'ff_polygons':
						makeflag({
							DFIntCSGLevelOfDetailSwitchingDistance: 0,
							DFIntCSGLevelOfDetailSwitchingDistanceL12: 0,
							DFIntCSGLevelOfDetailSwitchingDistanceL23: 0,
							DFIntCSGLevelOfDetailSwitchingDistanceL34: 0,
						});
						break;
					case 'ff_light_updates':
						makeflag({ FIntRenderLocalLightUpdatesMax: 1, FIntRenderLocalLightUpdatesMin: 1 });
						break;
				}
			}

			// Visual
			for (const name of Object.keys(categories.visual)) {
				const data = categories.visual[name];
				if (typeof data === 'boolean' && !data) continue;
				switch (name) {
					case 'ff_textures':
						makeflag({
							FStringPartTexturePackTablePre2022: '{"glass":{"ids":["rbxassetid://7547304948","rbxassetid://7546645118"],"color":[254,254,254,7]}}',
							FStringPartTexturePackTable2022: '{"glass":{"ids":["rbxassetid://7547304948","rbxassetid://7546645118"],"color":[254,254,254,7]}}',
							FStringTerrainMaterialTablePre2022: '',
							FStringTerrainMaterialTable2022: '',
						});
						break;
					case 'ff_lowquality':
						makeflag({ DFFlagTextureQualityOverrideEnabled: true, DFIntTextureQualityOverride: 0 });
						break;
					case 'ff_players_textures':
						makeflag({ DFIntTextureCompositorActiveJobs: 0 });
						break;
					case 'ff_debug_sky':
						makeflag({ FFlagDebugSkyGray: true });
						break;
				}
			}

			// UI
			for (const name of Object.keys(categories.ui)) {
				const data = categories.ui[name];
				if (typeof data === 'boolean' && !data) continue;
				switch (name) {
					case 'ff_font_size':
						makeflag({ FIntFontSizePadding: data[0] });
						break;
					case 'ff_old_font':
						makeflag({ FFlagEnableNewFontNameMappingABTest2: false });
						break;
					case 'ff_menu_version':
						switch (data.value.value) {
							case 'v1':
								makeflag({
									/* v2 */ FFlagDisableNewIGMinDUA: true,
									/* v4 */ FFlagEnableInGameMenuControls: false,
									FFlagEnableInGameMenuModernization: false,
									/* ABTest */ FFlagEnableMenuControlsABTest: false,
									FFlagEnableV3MenuABTest3: false,
									FFlagEnableInGameMenuChromeABTest3: false,
									/* Chrome */ FFlagEnableInGameMenuChrome: false,
								});
								// makeflag({
								// 	FFlagDisableNewIGMinDUA: true,
								// 	FFlagEnableInGameMenuControls: true,
								// 	FFlagEnableInGameMenuModernization: true,
								// 	FFlagEnableMenuControlsABTest: true,
								// 	FFlagEnableMenuModernizationABTest: true,
								// 	FFlagEnableMenuModernizationABTest2: true,
								// 	FFlagEnableV3MenuABTest3: true,
								// });
								break;
							case 'v2':
								makeflag({
									/* v2 */ FFlagDisableNewIGMinDUA: false,
									/* v4 */ FFlagEnableInGameMenuControls: false,
									FFlagEnableInGameMenuModernization: false,
									/* ABTest */ FFlagEnableMenuControlsABTest: false,
									FFlagEnableV3MenuABTest3: false,
									FFlagEnableInGameMenuChromeABTest3: false,
									/* Chrome */ FFlagEnableInGameMenuChrome: false,
								});
								break;
							case 'v4':
								makeflag({
									/* v2 */ FFlagDisableNewIGMinDUA: true,
									/* v4 */ FFlagEnableInGameMenuControls: true,
									FFlagEnableInGameMenuModernization: true,
									/* ABTest */ FFlagEnableMenuControlsABTest: false,
									FFlagEnableV3MenuABTest3: false,
									FFlagEnableInGameMenuChromeABTest3: false,
									/* Chrome */ FFlagEnableInGameMenuChrome: false,
								});
								break;
							case 'v4chrome':
								makeflag({
									FFlagEnableInGameMenuChrome: true,
									FFlagEnableReportAbuseMenuRoactABTest2: true,
									FFlagChromeBetaFeature: true,
									FFlagEnableInGameMenuChromeABTest2: true,
								});
								break;
						}
						break;
				}
			}

			// Utility
			for (const name of Object.keys(categories.utility)) {
				const data = categories.utility[name];
				if (typeof data === 'boolean' && !data) continue;
				switch (name) {
					case 'ff_gui':
						makeflag({ DFIntCanHideGuiGroupId: data });
						break;
					case 'ff_fullbright':
						makeflag({
							FFlagFastGPULightCulling3: true,
							FIntRenderShadowIntensity: 0,
							DFIntCullFactorPixelThresholdShadowMapHighQuality: 2147483647,
							DFIntCullFactorPixelThresholdShadowMapLowQuality: 2147483647,
							FFlagNewLightAttenuation: true,
							FIntRenderShadowmapBias: -1,
							DFFlagDebugPauseVoxelizer: true,
						});
						break;
					case 'ff_telemetry':
						makeflag({
							FFlagDebugDisableTelemetryEphemeralCounter: true,
							FFlagDebugDisableTelemetryEphemeralStat: true,
							FFlagDebugDisableTelemetryEventIngest: true,
							FFlagDebugDisableTelemetryPoint: true,
							FFlagDebugDisableTelemetryV2Counter: true,
							FFlagDebugDisableTelemetryV2Event: true,
							FFlagDebugDisableTelemetryV2Stat: true,
						});
						break;
				}
			}

			const integrationsFlags = await loadSettings('integrations');
			if (integrationsFlags && integrationsFlags.sdk.enabled && integrationsFlags.sdk.window) {
				makeflag({ FFlagUserIsBloxstrap: true, FFlagUserAllowsWindowMovement: true });
			}

			return fflagsJson;
		} else {
			if (!(await pathExists(path.join(appPath, 'fflags.json')))) {
				return {};
			}
			const neuPath = path.join(appPath, 'fflags.json');
			const skibidiOhioFanumTax: { flag: string; enabled: boolean; value: string | number }[] = JSON.parse(await filesystem.readFile(neuPath));
			for (const flag of skibidiOhioFanumTax) {
				if (flag.enabled) {
					fflagsJson[flag.flag] = flag.value;
				}
			}
			return fflagsJson;
		}
	}
}
