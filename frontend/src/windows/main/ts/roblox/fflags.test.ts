import { describe, expect, it, mock } from 'bun:test';

global.window = {
	NL_ARGS: [],
} as any;

mock.module('@neutralinojs/lib', () => ({
	os: { getEnv: mock(() => Promise.resolve('')) },
	events: {},
	filesystem: {},
	window: {},
	init: () => {},
}));

mock.module('svelte-sonner', () => ({
	toast: { success: mock(), error: mock(), info: mock() },
}));

mock.module('@root/package.json', () => ({
	default: { version: '0.0.0-test' },
}));

mock.module('../../components/settings', () => ({
	getValue: mock(() => Promise.resolve(null)),
	loadSettings: mock(() => Promise.resolve({})),
	getConfigPath: mock(() => Promise.resolve('/tmp/test-config')),
}));

mock.module('../../components/flag-editor', () => ({
	getAllProfiles: mock(() => Promise.resolve([])),
	getSelectedProfile: mock(() => Promise.resolve(null)),
	writeProfile: mock(() => Promise.resolve()),
}));

mock.module('../tools/shellfs', () => ({
	default: { exists: mock(() => Promise.resolve(false)) },
}));

mock.module('./path', () => ({
	detectRobloxPath: mock(() => Promise.resolve('/Applications/Roblox.app')),
}));

mock.module('@/windows/main/ts/utils/logger', () => ({
	default: {
		info: mock(),
		warn: mock(),
		error: mock(),
		debug: mock(),
		trace: mock(),
		withContext: mock(() => ({
			info: mock(),
			warn: mock(),
			error: mock(),
			debug: mock(),
			trace: mock(),
		})),
	},
	getLogBuffer: mock(() => []),
	getRecentErrors: mock(() => []),
	initializeLogger: mock(() => Promise.resolve()),
}));

import { FastFlagsList, type FFs } from './fflags';

describe('FastFlagsList', () => {
	describe('validateBatch', () => {
		it('should keep valid flags in validFlags', async () => {
			const flags = new FastFlagsList();
			const input: FFs = {
				DFIntCSGLevelOfDetailSwitchingDistance: 100,
				FFlagHandleAltEnterFullscreenManually: true,
			};

			const result = await flags.validateBatch(input);

			expect(result.validFlags).toEqual({
				DFIntCSGLevelOfDetailSwitchingDistance: 100,
				FFlagHandleAltEnterFullscreenManually: true,
			});
			expect(result.invalidFlags).toEqual({});
		});

		it('should put invalid flags in invalidFlags', async () => {
			const flags = new FastFlagsList();
			const input: FFs = {
				FakeFlagThatDoesNotExist: true,
				AnotherBogusFlag: 'hello',
			};

			const result = await flags.validateBatch(input);

			expect(result.validFlags).toEqual({});
			expect(result.invalidFlags).toEqual({
				FakeFlagThatDoesNotExist: true,
				AnotherBogusFlag: 'hello',
			});
		});

		it('should correctly partition a mix of valid and invalid flags', async () => {
			const flags = new FastFlagsList();
			const input: FFs = {
				DFIntCSGLevelOfDetailSwitchingDistance: 500,
				NotARealFlag: false,
				FFlagDebugGraphicsPreferVulkan: true,
				CompletelyMadeUp: 42,
			};

			const result = await flags.validateBatch(input);

			expect(result.validFlags).toEqual({
				DFIntCSGLevelOfDetailSwitchingDistance: 500,
				FFlagDebugGraphicsPreferVulkan: true,
			});
			expect(result.invalidFlags).toEqual({
				NotARealFlag: false,
				CompletelyMadeUp: 42,
			});
		});

		it('should return empty objects for empty input', async () => {
			const flags = new FastFlagsList();
			const result = await flags.validateBatch({});

			expect(result.validFlags).toEqual({});
			expect(result.invalidFlags).toEqual({});
		});

		it('should accept all known ALLOWED_FLAGS entries', async () => {
			const flags = new FastFlagsList();
			const knownFlags: FFs = {
				DFIntCSGLevelOfDetailSwitchingDistance: 1,
				DFIntCSGLevelOfDetailSwitchingDistanceL12: 2,
				DFIntCSGLevelOfDetailSwitchingDistanceL23: 3,
				DFIntCSGLevelOfDetailSwitchingDistanceL34: 4,
				FFlagHandleAltEnterFullscreenManually: true,
				DFFlagTextureQualityOverrideEnabled: true,
				DFIntTextureQualityOverride: 3,
				FIntDebugForceMSAASamples: 4,
				DFFlagDisableDPIScale: true,
				FFlagDebugGraphicsPreferD3D11: true,
				FFlagDebugSkyGray: true,
				DFFlagDebugPauseVoxelizer: true,
				DFIntDebugFRMQualityLevelOverride: 10,
				DFIntDebugDynamicRenderKiloPixels: 2000,
				FIntFRMMaxGrassDistance: 1000,
				FIntFRMMinGrassDistance: 100,
				FFlagDebugGraphicsPreferVulkan: true,
				FFlagDebugGraphicsPreferOpenGL: true,
				FFlagDebugGraphicsDisableMetal: true,
				FFlagDebugGraphicsPreferMetal: true,
				FIntGrassMovementReducedMotionFactor: 50,
			};

			const result = await flags.validateBatch(knownFlags);

			expect(Object.keys(result.invalidFlags)).toHaveLength(0);
			expect(Object.keys(result.validFlags)).toHaveLength(Object.keys(knownFlags).length);
		});

		it('should preserve flag values of different types', async () => {
			const flags = new FastFlagsList();
			const input: FFs = {
				FFlagDebugSkyGray: true,
				DFIntCSGLevelOfDetailSwitchingDistance: 0,
				DFIntDebugFRMQualityLevelOverride: 7,
			};

			const result = await flags.validateBatch(input);

			expect(result.validFlags['FFlagDebugSkyGray']).toBe(true);
			expect(result.validFlags['DFIntCSGLevelOfDetailSwitchingDistance']).toBe(0);
			expect(result.validFlags['DFIntDebugFRMQualityLevelOverride']).toBe(7);
		});
	});

	describe('addFlag', () => {
		it('should return the instance for chaining', () => {
			const flags = new FastFlagsList();
			const result = flags.addFlag({
				name: 'Test',
				flags: { FFlagDebugSkyGray: true },
				path: 'engine.visual.debug_sky',
				type: 'switch',
				value: true,
			});

			expect(result).toBe(flags);
		});

		it('should support adding multiple flags via chaining', () => {
			const flags = new FastFlagsList();
			const result = flags
				.addFlag({
					name: 'First',
					flags: { FFlagDebugSkyGray: true },
					path: 'engine.visual.debug_sky',
					type: 'switch',
					value: true,
				})
				.addFlag({
					name: 'Second',
					flags: { DFFlagDisableDPIScale: true },
					path: 'engine.graphics.fracscaling',
					type: 'switch',
					value: true,
				});

			expect(result).toBe(flags);
		});
	});
});
