import { events, app as neuApp, window as neuWindow, os, filesystem, server } from '@neutralinojs/lib';
import beautify from 'json-beautify';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import { getValue } from '../../components/settings';
import { libraryPath } from '../libraries';
import { Notification } from '../tools/notifications';
import { RPCController } from '../tools/rpc';
import { shell, spawn, type SpawnEventEmitter } from '../tools/shell';
import shellFS from '../tools/shellfs';
import { getMode, sleep } from '../utils';
import { getDataDir } from '../utils/paths';
import { focusWindow, setWindowVisibility } from '../window';
import onGameEvent from './events';
import { RobloxFFlags } from './fflags';
import { RobloxInstance } from './instance';
import { RobloxMods } from './mods';
import { detectRobloxPath } from './path';
import { RobloxUtils } from './utils';
import {
	isRegionSelectionAvailable,
	getRegionPreference,
	parsePlaceIdFromUrl,
	selectServerWithPreferredRegion,
} from './region-selector';
import { formatDatacenterLocation } from './rovalra-api';
import * as VirtualDisplay from './virtualdisplay';
import { parseBootstrapperTheme } from '@/windows/bootstrapper/wpfui-theme';
import Logger from '../utils/logger';

const logger = Logger.withContext('Launch');

/** Delay in ms added between each visible bootstrapper step when the setting is enabled. */
const FIXED_STEP_DELAY = 1200;

let _allowFixedDelays: boolean | null = null;
async function getAllowFixedDelays(): Promise<boolean> {
	if (_allowFixedDelays !== null) return _allowFixedDelays;
	try {
		_allowFixedDelays = (await getValue<boolean>('misc.advanced.allow_fixed_Loading_times_v2')) ?? true;
	} catch {
		_allowFixedDelays = true;
	}
	return _allowFixedDelays;
}

let rbxInstance: RobloxInstance | null = null;
let bootstrapperProcess: SpawnEventEmitter | null = null;
let initialProgressListener: ((evt: { detail: string }) => Promise<void>) | null = null;

interface LaunchSettings {
	areModsEnabled: boolean;
	fixResolution: boolean;
	returnToWebsite: boolean;
	closeOnExit: boolean;
}

interface LaunchHandlers {
	setRobloxConnected: (value: boolean) => void;
	setLaunchingRoblox: (value: boolean) => void;
	showFlagErrorPopup: (title: string, description: string, code: string, flagNames?: string[]) => Promise<void>;
}

async function validateAndCleanup(): Promise<boolean> {
	if (rbxInstance) {
		toast.error('An AppleBlox-launched Roblox instance is already running.');
		return false;
	}
	if (bootstrapperProcess) {
		toast.info('Bootstrapper is already running.');
		return false;
	}

	if (await shellFS.exists('/tmp/appleblox_bootstrapper.pid')) {
		try {
			const oldPid = await shellFS.readFile('/tmp/appleblox_bootstrapper.pid');
			await os.execCommand(`kill ${oldPid.trim()}`);
		} catch (err) {
			logger.debug('Could not kill old bootstrapper process:', err);
		}
		await shellFS.remove('/tmp/appleblox_bootstrapper.pid');
	}

	if ((await shell('pgrep', ['-f', 'RobloxPlayer'], { skipStderrCheck: true })).stdOut.trim().length > 3) {
		await shell('pkill', ['-9', '-f', 'RobloxPlayer'], { skipStderrCheck: true });
	}

	return true;
}

async function validateFlags(showFlagErrorPopup: LaunchHandlers['showFlagErrorPopup'], checkFlags = true): Promise<any> {
	await updateBootstrapper('bootstrapper:text', { text: 'Validating preset flags...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 15 });
	if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);

	const presetFlags = await RobloxFFlags.parseFlags(true);

	if (Object.keys(presetFlags.invalidFlags).length > 0 && checkFlags) {
		await showFlagErrorPopup(
			'Outdated presets',
			'Some preset flags are no longer valid. Make sure you are on the latest version of AppleBlox.',
			presetFlags.nameMap.join(', ')
		);
	}

	await updateBootstrapper('bootstrapper:text', { text: 'Validating custom flags...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 25 });
	if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);

	const editorFlags = await RobloxFFlags.parseFlags(false);

	if (editorFlags.invalidFlags.length > 0 && checkFlags) {
		await showFlagErrorPopup(
			'Invalid flags in selected profile',
			'The following flags in your current profile are invalid and will have no effect.',
			editorFlags.invalidFlags.join(', '),
			editorFlags.invalidFlags
		);
	}

	await updateBootstrapper('bootstrapper:text', { text: 'Validating game profiles...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 30 });
	if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);

	if (checkFlags && editorFlags.invalidProfileFlags && editorFlags.invalidProfileFlags.length > 0) {
		const allFlagKeys = editorFlags.invalidProfileFlags.reduce(
			(keys: string[], pf: any) => [...keys, ...Object.keys(pf.flags)],
			[] as string[]
		);
		await showFlagErrorPopup(
			'Invalid flags in game profile(s)',
			'Some game-specific profiles contain invalid flags that will have no effect.',
			editorFlags.invalidProfileFlags
				.map((pf: any) => `${pf.name.toUpperCase()}:\n ${beautify(pf.flags, null, 2, 100)}`)
				.join('<br><br>'),
			allFlagKeys
		);
	}

	Logger.info('Using FastFlags: ', { ...editorFlags.validFlags, ...presetFlags.validFlags });

	return {
		...editorFlags.validFlags,
		...presetFlags.validFlags,
	};
}

async function setupBootstrapper(): Promise<void> {
	const neutralinoConfig = await neuApp.getConfig();
	const vitePort = neutralinoConfig.cli.frontendLibrary.devUrl.split(':').pop();

	const baseHtmlUrl =
		getMode() === 'dev'
			? `http://localhost:${vitePort}/bootstrapper.html`
			: `http://localhost:${window.NL_PORT}/bootstrapper.html`;

	const dataDir = await getDataDir();
	const themePath = path.join(dataDir, 'bootstrapper-theme.xml');
	const assetsDir = path.join(dataDir, 'bootstrapper-theme-assets');
	let hasTheme = await shellFS.exists(themePath);

	if (hasTheme) {
		let themeWidth = 700;
		let themeHeight = 450;
		let themeB64 = '';

		try {
			const xml = await shellFS.readFile(themePath);
			const parsed = parseBootstrapperTheme(xml);
			if (parsed) {
				themeWidth = parsed.width;
				themeHeight = parsed.height;

				// Mount theme assets so the child window can load them via the main backend's HTTP server.
				try {
					const dirStats = await filesystem.getStats(assetsDir);
					if (dirStats.isDirectory) {
						await server.mount('/bootstrapper-assets/', assetsDir);
					}
				} catch {}

				// Base64url-encode the parsed theme and pass it in the URL so the child window
				// can render the theme without needing a separate filesystem read.
				themeB64 = btoa(unescape(encodeURIComponent(JSON.stringify(parsed))))
					.replace(/\+/g, '-')
					.replace(/\//g, '_')
					.replace(/=/g, '');
			}
		} catch {}

		// Scale proportionally to a 1920×1080 Windows reference so themes occupy the same
		// relative fraction of the screen as they would on a typical 1080p Windows display.
		// No cap at 1 — on a 2560-wide screen a 600px theme becomes ~800px (same proportion).
		// The last two terms clamp themes that are inherently larger than 1920×1080 so they
		// always fit within 95% of the screen.
		const screenWidth = window.screen.width;
		const screenHeight = window.screen.height;
		const scale = Math.min(
			screenWidth / 1920,
			screenHeight / 1080,
			(screenWidth * 0.95) / themeWidth,
			(screenHeight * 0.95) / themeHeight
		);
		const scaledWidth = Math.round(themeWidth * scale);
		const scaledHeight = Math.round(themeHeight * scale);

		// Resolve the Neutralino binary path: dev uses the universal binary in bin/ (no arch
		// detection needed), prod uses the main binary in Contents/MacOS/.
		const w = window as any;
		const nlPath: string = window.NL_PATH ?? '';
		const isDev = getMode() === 'dev';
		const binaryPath = isDev
			? path.join(nlPath, 'bin', 'neutralino-mac_universal')
			: path.join(nlPath, '../MacOS/main');

		// Build URL — include parent's NL_TOKEN/NL_PORT so the child frontend connects to
		// the parent Neutralino backend (required for events.broadcast to reach the parent).
		const bootstrapperUrlParams = new URLSearchParams({
			nl_token: w.NL_TOKEN ?? '',
			nl_port: String(window.NL_PORT ?? ''),
			scale: scale.toFixed(4),
		});
		if (themeB64) bootstrapperUrlParams.set('theme', themeB64);
		const bootstrapperUrl = `${baseHtmlUrl}?${bootstrapperUrlParams.toString()}`;

		// Compute centered position using raw x/y to avoid the crashing center() C++ call.
		// Use scaled window dimensions for centering so the window is always on screen.
		// Clamp to 0 so the window never starts off-screen.
		const centeredX = Math.max(0, Math.round((screenWidth - scaledWidth) / 2));
		const centeredY = Math.max(0, Math.round((screenHeight - scaledHeight) / 2));

		logger.info(`Spawning themed Neutralino bootstrapper (${scaledWidth}×${scaledHeight}, scale=${scale.toFixed(3)})`);

		// In dev, --res-mode=directory tells the child to load neutralino.config.json from
		// --path (the project root) instead of looking for a resources.neu bundle that
		// doesn't exist in the dev tree, which would cause it to load default config.
		const resModeArg = isDev ? '--res-mode=directory' : '--res-mode=bundle';

		try {
			bootstrapperProcess = await spawn(
				binaryPath,
				[
					`--path=${nlPath}`,
					resModeArg,
					`--url=${bootstrapperUrl}`,
					`--window-hidden=false`,
					`--window-width=${themeWidth}`,
					`--window-height=${themeHeight}`,
					`--window-borderless=true`,
					`--window-transparent=true`,
					`--window-always-on-top=true`,
					`--window-resizable=false`,
					`--window-center=false`,
					`--window-inject-globals=false`,
					`--window-exit-process-on-close=true`,
					`--window-x=${centeredX}`,
					`--window-y=${centeredY}`,
				],
				{ skipStderrCheck: true }
			);

			await shellFS.writeFile('/tmp/appleblox_bootstrapper.pid', bootstrapperProcess.pid?.toString() || '');

			bootstrapperProcess.on('stdOut', (data) => logger.info('[Bootstrapper]', data));
			bootstrapperProcess.on('stdErr', (data) => logger.error('[Bootstrapper]', data));
			bootstrapperProcess.on('exit', (code) => {
				logger.info(`Bootstrapper exited with code ${code}`);
				if (bootstrapperProcess) {
					bootstrapperProcess = null;
					if (!rbxInstance) {
						neuWindow.show().then(focusWindow);
					}
				}
			});
		} catch (e) {
			logger.warn('Failed to spawn themed bootstrapper, falling back to default UI:', e);
			hasTheme = false;
		}
	}

	if (!hasTheme) {
		const viewerPath = libraryPath('transparent_viewer');
		const viewerArgs = ['--width', '700', '--height', '450', '--url', baseHtmlUrl];

		logger.info(`Spawning transparent_viewer bootstrapper`);
		bootstrapperProcess = await spawn(viewerPath, viewerArgs, { skipStderrCheck: true });

		await shellFS.writeFile('/tmp/appleblox_bootstrapper.pid', bootstrapperProcess.pid?.toString() || '');

		bootstrapperProcess.on('stdOut', (data) => logger.info('[Bootstrapper]', data));
		bootstrapperProcess.on('stdErr', (data) => logger.error('[Bootstrapper]', data));
		bootstrapperProcess.on('exit', (code) => {
			logger.info(`Bootstrapper exited with code ${code}`);
			if (bootstrapperProcess) {
				bootstrapperProcess = null;
				if (!rbxInstance) {
					neuWindow.show().then(focusWindow);
				}
			}
		});
	}

	initialProgressListener = async () => {
		await updateBootstrapper('bootstrapper:text', { text: 'Initializing launch sequence...' });
		await updateBootstrapper('bootstrapper:progress', { progress: 5 });
	};
	events.on('bootstrapper:ready', initialProgressListener);

	await sleep(500);
}

async function updateBootstrapper(event: string, data: any): Promise<void> {
	try {
		setTimeout(async () => {
			try {
				await events.broadcast(event, data);
			} catch (e) {
				logger.warn(`Failed to broadcast ${event}:`, e);
			}
		}, 0);
	} catch (e) {
		logger.warn(`Failed to schedule broadcast for ${event}:`, e);
	}
}

async function cleanupBootstrapper(): Promise<void> {
	if (initialProgressListener) {
		try {
			await events.off('bootstrapper:ready', initialProgressListener);
		} catch {}
		initialProgressListener = null;
	}

	if (bootstrapperProcess) {
		try {
			await bootstrapperProcess.kill(true);
		} catch (e) {
			logger.error('Error terminating bootstrapper:', e);
		}
		bootstrapperProcess = null;
		if (await shellFS.exists('/tmp/appleblox_bootstrapper.pid')) {
			await shellFS.remove('/tmp/appleblox_bootstrapper.pid');
		}
	}
}

/**
 * Apply region selection if enabled and available
 * Returns the (possibly modified) URL to use for launching
 */
async function applyRegionSelection(originalUrl?: string): Promise<string | undefined> {
	// Skip if no URL provided (manual launch)
	if (!originalUrl) {
		return undefined;
	}

	// Check if region selection is available
	const available = await isRegionSelectionAvailable();
	if (!available) {
		logger.debug('Region selection not available');
		return originalUrl;
	}

	const preference = await getRegionPreference();
	if (!preference.enabled || preference.region === 'AUTO') {
		logger.debug('Region selection disabled or set to AUTO');
		return originalUrl;
	}

	// Extract place ID from URL
	const placeId = parsePlaceIdFromUrl(originalUrl);
	if (!placeId) {
		logger.warn('Could not parse place ID from URL, skipping region selection');
		return originalUrl;
	}

	await updateBootstrapper('bootstrapper:text', { text: `Finding server in ${preference.region}...` });

	try {
		const result = await selectServerWithPreferredRegion(placeId, originalUrl);

		if (result.success && result.url) {
			logger.info(`Region selection: ${result.message}`);

			// Show notification about the region
			if (result.region) {
				toast.info(`Joining server in ${formatDatacenterLocation(result.region)}`);
			} else {
				toast.info(result.message || `Joining server in ${preference.region}`);
			}

			return result.url;
		} else {
			// Region selection failed, fall back to original URL
			logger.warn(`Region selection failed: ${result.message}`);
			toast.warning(result.message || 'Could not find server in preferred region');
			return originalUrl;
		}
	} catch (error) {
		logger.error('Region selection error:', error);
		// Don't fail the launch, just use the original URL
		return originalUrl;
	}
}

async function prepareRobloxSettings(robloxPath: string, fflags: any): Promise<void> {
	await updateBootstrapper('bootstrapper:text', { text: 'Checking existing settings...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 35 });
	if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);

	const settingsPath = path.join(robloxPath, 'Contents/MacOS/ClientSettings/');
	const settingsFile = path.join(settingsPath, 'ClientAppSettings.json');

	if (await shellFS.exists(settingsFile)) {
		await updateBootstrapper('bootstrapper:text', { text: 'Removing old settings...' });
		await updateBootstrapper('bootstrapper:progress', { progress: 40 });
		if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);
		await shellFS.remove(settingsPath);
	}

	await updateBootstrapper('bootstrapper:text', { text: 'Creating settings directory...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 45 });
	if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);
	await shellFS.createDirectory(settingsPath);

	await updateBootstrapper('bootstrapper:text', { text: 'Writing FastFlags configuration...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 50 });
	if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);
	await shellFS.writeFile(settingsFile, JSON.stringify(fflags));
}

async function applyModsAndLaunch(settings: LaunchSettings, robloxUrl?: string): Promise<RobloxInstance> {
	// Create icon color backup BEFORE mods are applied (so we have the original files)
	await updateBootstrapper('bootstrapper:text', { text: 'Creating backups...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 53 });
	if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);
	await RobloxMods.createIconColorBackup();

	if (settings.areModsEnabled) {
		await updateBootstrapper('bootstrapper:text', { text: 'Copying mod files...' });
		await updateBootstrapper('bootstrapper:progress', { progress: 55 });
		if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);
		await RobloxMods.copyToFiles();
	}

	await updateBootstrapper('bootstrapper:text', { text: 'Applying custom fonts...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 60 });
	if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);
	await RobloxMods.applyCustomFont();

	// Apply icon color AFTER mods so it takes priority over any mod-modified BuilderIcons
	await updateBootstrapper('bootstrapper:text', { text: 'Applying icon color...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 70 });
	if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);
	await RobloxMods.applyIconColor();

	// Legacy resolution is now handled via launch argument in RobloxInstance.start()
	// No need to modify plist file anymore

	await updateBootstrapper('bootstrapper:text', { text: 'Initializing Roblox instance...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 80 });
	if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);

	const robloxInstance = new RobloxInstance(true);
	await robloxInstance.init();

	await updateBootstrapper('bootstrapper:text', { text: 'Starting Roblox...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 100 });
	if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);

	const fpsUnlockRaw = await getValue<string | { label: string; value: string }>('engine.graphics.fps_unlock');
	const fpsUnlockMethod = typeof fpsUnlockRaw === 'object' && fpsUnlockRaw !== null ? fpsUnlockRaw.value : (fpsUnlockRaw ?? 'vsync');
	if (fpsUnlockMethod === 'virtualdisplay') {
		await VirtualDisplay.start();
	}

	await cleanupBootstrapper();
	await robloxInstance.start(robloxUrl);

	return robloxInstance;
}

async function setupRobloxInstance(
	robloxInstance: RobloxInstance,
	settings: LaunchSettings,
	handlers: LaunchHandlers
): Promise<void> {
	handlers.setRobloxConnected(true);
	rbxInstance = robloxInstance;

	if ((await getValue('integrations.rpc.enabled')) === true) {
		RPCController.preset('inRobloxApp');
	}

	robloxInstance.on('gameEvent', onGameEvent);
	robloxInstance.on('exit', async () => {
		logger.info('Roblox instance exited');

		await VirtualDisplay.stop();

		if (settings.returnToWebsite) {
			os.open('https://www.roblox.com');
		}
		await RobloxMods.restoreRobloxFolders(settings.areModsEnabled);
		// Always restore from icon-color-backup since mods might be disabled
		// (in which case restoreRobloxFolders doesn't restore the Resources folder)
		await RobloxMods.removeIconColor(true);
		// Legacy resolution is now handled via launch argument, no plist cleanup needed
		RPCController.stop();

		handlers.setRobloxConnected(false);
		rbxInstance = null;
		handlers.setLaunchingRoblox(false);

		const deeplinkArg = window.NL_ARGS.find((arg) => arg.includes('--deeplink='));
		if (deeplinkArg) {
			events.broadcast('exitApp');
		} else {
			await neuWindow.show();
			focusWindow();
		}
		if (settings.closeOnExit) events.broadcast('exitApp');
	});
}

export async function launchRoblox(
	setRobloxConnected: (value: boolean) => void,
	setLaunchingRoblox: (value: boolean) => void,
	showFlagErrorPopup: (title: string, description: string, code: string, flagNames?: string[]) => Promise<void>,
	robloxUrl?: string,
	checkFlags = true
) {
	const handlers: LaunchHandlers = { setRobloxConnected, setLaunchingRoblox, showFlagErrorPopup };

	const settings: LaunchSettings = {
		areModsEnabled: (await getValue<boolean>('mods.general.enabled')) === true,
		fixResolution: (await getValue<boolean>('mods.general.fix_res')) === true,
		returnToWebsite: (await getValue<boolean>('roblox.behavior.return_to_website')) === true,
		closeOnExit: (await getValue<boolean>('roblox.behavior.close_on_exit')) === true,
	};

	if (!(await validateAndCleanup())) {
		return;
	}

	setLaunchingRoblox(true);

	try {
		const fflags = await validateFlags(showFlagErrorPopup, checkFlags);

		if (!robloxUrl) await setWindowVisibility(false);
		await setupBootstrapper();

		await updateBootstrapper('bootstrapper:text', { text: 'Checking Roblox installation...' });
		await updateBootstrapper('bootstrapper:progress', { progress: 10 });
		if (await getAllowFixedDelays()) await sleep(FIXED_STEP_DELAY);

		const hasRoblox = await RobloxUtils.hasRoblox();

		if (!hasRoblox) {
			await cleanupBootstrapper();
			setLaunchingRoblox(false);
			if (robloxUrl) {
				const installNotif = new Notification({
					title: 'Failed to launch',
					content: 'AppleBlox could not find Roblox. Launch Roblox from the AppleBlox app to resolve this.',
					sound: 'hero',
					timeout: 30,
				});
				const closeAppHandler = () => events.broadcast('exitApp');
				installNotif.on('action', (action) => {
					if (action.value == 'download') os.open('https://roblox.com/download');
					events.broadcast('exitApp');
				});
				installNotif.on('closed', closeAppHandler);
				installNotif.on('clicked', closeAppHandler);
				installNotif.on('timeout', closeAppHandler);
				installNotif.show();
			} else {
				neuWindow.show();
			}
			return;
		}

		const robloxPath = await detectRobloxPath();
		if (!robloxPath) {
			throw new Error('Roblox installation not found. Cannot launch Roblox.');
		}
		await prepareRobloxSettings(robloxPath, fflags);

		// Apply region selection if enabled
		const finalUrl = await applyRegionSelection(robloxUrl);

		// Inject the active account's cookie into Roblox's binary cookies file
		// so Roblox launches as the correct account
		await updateBootstrapper('bootstrapper:text', { text: 'Setting up account...' });
		

		try {
			const robloxInstance = await applyModsAndLaunch(settings, finalUrl);
			await setupRobloxInstance(robloxInstance, settings, handlers);

			setTimeout(async () => {
				try {
					await shellFS.remove(path.join(robloxPath, 'Contents/MacOS/ClientSettings/'));
				} catch (err) {
					logger.warn('Failed to cleanup settings:', err);
				}
			}, 5_000);
		} catch (err) {
			setTimeout(async () => {
				try {
					await RobloxMods.restoreRobloxFolders(settings.areModsEnabled);
					await RobloxMods.removeIconColor(true);
					await shellFS.remove(path.join(robloxPath, 'Contents/MacOS/ClientSettings/'));
					// Legacy resolution is now handled via launch argument, no plist cleanup needed
				} catch (cleanupErr) {
					logger.error('Error during error cleanup:', cleanupErr);
				}
			}, 0);

			logger.error(err);
			toast.error('An error occurred while starting Roblox.');

			await cleanupBootstrapper();
			setLaunchingRoblox(false);
			await neuWindow.show();
			return;
		}
	} catch (err) {
		logger.error('Critical error during launch:', err);
		await cleanupBootstrapper();
		await neuWindow.show();
		focusWindow();
		setLaunchingRoblox(false);
		setRobloxConnected(false);
		toast.error('Failed to launch Roblox due to a critical error.');
	}
}
