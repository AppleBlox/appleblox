import { events, app as neuApp, window as neuWindow, os } from '@neutralinojs/lib';
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
import Logger from '../utils/logger';

const logger = Logger.withContext('Launch');

let allowFixedDelays = true;
getValue<boolean>('misc.advanced.allow_fixed_loading_times')
	.then((value) => {
		allowFixedDelays = value;
	})
	.catch((err) => {
		logger.error("Couldn't determine loading time settings:", err);
	});

let rbxInstance: RobloxInstance | null = null;
let bootstrapperProcess: SpawnEventEmitter | null = null;
let initialProgressListener: any = null;

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
		} catch {}
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
	if (allowFixedDelays) await sleep(300);

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
	if (allowFixedDelays) await sleep(300);

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
	if (allowFixedDelays) await sleep(250);

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

	const bootstrapperHtmlUrl =
		getMode() === 'dev'
			? `http://localhost:${vitePort}/bootstrapper.html`
			: `http://localhost:${window.NL_PORT}/bootstrapper.html`;

	const viewerPath = libraryPath('transparent_viewer');
	const windowWidth = 700;
	const windowHeight = 450;

	const viewerArgs = ['--width', windowWidth.toString(), '--height', windowHeight.toString(), '--url', bootstrapperHtmlUrl];

	logger.info(`Spawning transparent_viewer: ${viewerPath} ${viewerArgs.join(' ')}`);
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

	initialProgressListener = events.on('bootstrapper:ready', async () => {
		await updateBootstrapper('bootstrapper:text', { text: 'Initializing launch sequence...' });
		await updateBootstrapper('bootstrapper:progress', { progress: 5 });
	});

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
	if (allowFixedDelays) await sleep(200);

	const settingsPath = path.join(robloxPath, 'Contents/MacOS/ClientSettings/');
	const settingsFile = path.join(settingsPath, 'ClientAppSettings.json');

	if (await shellFS.exists(settingsFile)) {
		await updateBootstrapper('bootstrapper:text', { text: 'Removing old settings...' });
		await updateBootstrapper('bootstrapper:progress', { progress: 40 });
		if (allowFixedDelays) await sleep(250);
		await shellFS.remove(settingsPath);
	}

	await updateBootstrapper('bootstrapper:text', { text: 'Creating settings directory...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 45 });
	if (allowFixedDelays) await sleep(200);
	await shellFS.createDirectory(settingsPath);

	await updateBootstrapper('bootstrapper:text', { text: 'Writing FastFlags configuration...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 50 });
	if (allowFixedDelays) await sleep(300);
	await shellFS.writeFile(settingsFile, JSON.stringify(fflags));
}

async function applyModsAndLaunch(settings: LaunchSettings, robloxUrl?: string): Promise<RobloxInstance> {
	// Create icon color backup BEFORE mods are applied (so we have the original files)
	await updateBootstrapper('bootstrapper:text', { text: 'Creating backups...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 53 });
	if (allowFixedDelays) await sleep(150);
	await RobloxMods.createIconColorBackup();

	if (settings.areModsEnabled) {
		await updateBootstrapper('bootstrapper:text', { text: 'Copying mod files...' });
		await updateBootstrapper('bootstrapper:progress', { progress: 55 });
		if (allowFixedDelays) await sleep(350);
		await RobloxMods.copyToFiles();
	}

	await updateBootstrapper('bootstrapper:text', { text: 'Applying custom fonts...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 60 });
	if (allowFixedDelays) await sleep(250);
	await RobloxMods.applyCustomFont();

	// Apply icon color AFTER mods so it takes priority over any mod-modified BuilderIcons
	await updateBootstrapper('bootstrapper:text', { text: 'Applying icon color...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 70 });
	if (allowFixedDelays) await sleep(200);
	await RobloxMods.applyIconColor();

	// Legacy resolution is now handled via launch argument in RobloxInstance.start()
	// No need to modify plist file anymore

	await updateBootstrapper('bootstrapper:text', { text: 'Initializing Roblox instance...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 80 });
	if (allowFixedDelays) await sleep(400);

	const robloxInstance = new RobloxInstance(true);
	await robloxInstance.init();

	await updateBootstrapper('bootstrapper:text', { text: 'Starting Roblox...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 100 });
	if (allowFixedDelays) await sleep(450);

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
		if (allowFixedDelays) await sleep(250);

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
