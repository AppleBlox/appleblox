import { events, app as neuApp, window as neuWindow, os } from '@neutralinojs/lib';
import beautify from 'json-beautify';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import { getValue } from '../../components/settings';
import { libraryPath } from '../libraries';
import { RPCController } from '../tools/rpc';
import { shell, spawn, type SpawnEventEmitter } from '../tools/shell';
import shellFS from '../tools/shellfs';
import { getMode, sleep } from '../utils';
import { focusWindow } from '../window';
import onGameEvent from './events';
import { RobloxFFlags } from './fflags';
import { RobloxInstance } from './instance';
import { RobloxMods } from './mods';
import { getMostRecentRoblox } from './path';
import { RobloxUtils } from './utils';

let allowFixedDelays = true;
getValue<boolean>('misc.advanced.allow_fixed_loading_times')
	.then((value) => {
		allowFixedDelays = value;
	})
	.catch((err) => {
		console.error("[Launch] Couldn't determine if loading times should have a min value:", err);
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
		} catch (e) {
			// ignore
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
	if (allowFixedDelays) await sleep(300);

	const presetFlags = await RobloxFFlags.parseFlags(true);
	if (Object.keys(presetFlags.invalidFlags).length > 0 && checkFlags) {
		await showFlagErrorPopup(
			'Outdated presets',
			'Some preset flags are no longer valid and may not work as intended. This issue requires AppleBlox to be updated by the devlopers. Make sure you are on the latest version of the app.',
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
			'The following flags in your current profile are invalid meaning they will have no effect on your game. You can choose to ignore this warning or remove the problematic flags.',
			editorFlags.invalidFlags.join(', '),
			editorFlags.invalidFlags
		);
	}

	await updateBootstrapper('bootstrapper:text', { text: 'Validating game profiles...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 30 });
	if (allowFixedDelays) await sleep(250);

	if (checkFlags && editorFlags.invalidProfileFlags && editorFlags.invalidProfileFlags.length > 0) {
		const allFlagKeys = editorFlags.invalidProfileFlags.reduce<string[]>(
			(keys, pf) => [...keys, ...Object.keys(pf.flags)],
			[]
		);
		await showFlagErrorPopup(
			'Invalid flags in game profile(s)',
			'Some game-specific profiles contain invalid flags that will have no effect on your game. You can choose to ignore this warning or remove the problematic flags.',
			editorFlags.invalidProfileFlags
				.map((pf) => `${pf.name.toUpperCase()}:\n ${beautify(pf.flags, null, 2, 100)}`)
				.join('<br><br>'),
			allFlagKeys
		);
	}

	return {
		...editorFlags.validFlags,
		...editorFlags.invalidFlags,
		...presetFlags.validFlags,
		...presetFlags.invalidFlags,
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

	console.info(`[Launch] Spawning transparent_viewer: ${viewerPath} ${viewerArgs.join(' ')}`);
	bootstrapperProcess = await spawn(viewerPath, viewerArgs, { skipStderrCheck: true });

	await shellFS.writeFile('/tmp/appleblox_bootstrapper.pid', bootstrapperProcess.pid?.toString() || '');

	bootstrapperProcess.on('stdOut', (data) => console.info('[Bootstrapper Out]', data));
	bootstrapperProcess.on('stdErr', (data) => console.error('[Bootstrapper Err]', data));
	bootstrapperProcess.on('exit', (code) => {
		console.info(`[Launch] Bootstrapper process exited with code ${code}.`);
		if (bootstrapperProcess) {
			bootstrapperProcess = null;
			if (!rbxInstance) {
				neuWindow.show().then(focusWindow);
			}
		}
	});

	initialProgressListener = events.on('bootstrapper:ready', async () => {
		console.info('[Launch] Bootstrapper reported ready. Sending initial state.');
		await updateBootstrapper('bootstrapper:text', { text: 'Initializing launch sequence...' });
		await updateBootstrapper('bootstrapper:progress', { progress: 5 });
	});

	await sleep(500);
}

async function updateBootstrapper(event: string, data: any): Promise<void> {
	try {
		await events.broadcast(event, data);
	} catch (e) {
		console.warn(`Failed to broadcast ${event} to bootstrapper:`, e);
	}
}

async function cleanupBootstrapper(): Promise<void> {
	if (initialProgressListener && typeof initialProgressListener === 'function') {
		try {
			await events.off('bootstrapper:ready', initialProgressListener);
		} catch (e) {
			console.warn('Failed to unregister initialProgressListener', e);
		}
		initialProgressListener = null;
	}
	if (bootstrapperProcess) {
		try {
			await bootstrapperProcess.kill(true);
			console.info('[Launch] Bootstrapper process terminated.');
		} catch (e) {
			console.error('[Launch] Error terminating bootstrapper process:', e);
		}
		bootstrapperProcess = null;
		if (await shellFS.exists('/tmp/appleblox_bootstrapper.pid')) {
			await shellFS.remove('/tmp/appleblox_bootstrapper.pid');
		}
	}
}

async function prepareRobloxSettings(robloxPath: string, fflags: any): Promise<void> {
	await updateBootstrapper('bootstrapper:text', { text: 'Checking existing settings...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 35 });
	if (allowFixedDelays) await sleep(200);

	if (await shellFS.exists(path.join(robloxPath, 'Contents/MacOS/ClientSettings/ClientAppSettings.json'))) {
		await updateBootstrapper('bootstrapper:text', { text: 'Removing old settings...' });
		await updateBootstrapper('bootstrapper:progress', { progress: 40 });
		if (allowFixedDelays) await sleep(250);
		await shellFS.remove(path.join(robloxPath, 'Contents/MacOS/ClientSettings/'));
	}

	await updateBootstrapper('bootstrapper:text', { text: 'Creating settings directory...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 45 });
	if (allowFixedDelays) await sleep(200);
	await shellFS.createDirectory(path.join(robloxPath, 'Contents/MacOS/ClientSettings'));

	await updateBootstrapper('bootstrapper:text', { text: 'Writing FastFlags configuration...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 50 });
	if (allowFixedDelays) await sleep(300);
	await shellFS.writeFile(
		path.join(robloxPath, 'Contents/MacOS/ClientSettings/ClientAppSettings.json'),
		JSON.stringify(fflags)
	);
}

async function applyModsAndLaunch(settings: LaunchSettings, robloxUrl?: string): Promise<RobloxInstance> {
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

	await updateBootstrapper('bootstrapper:text', { text: 'Configuring graphics settings...' });
	await updateBootstrapper('bootstrapper:progress', { progress: 65 });
	if (allowFixedDelays) await sleep(300);
	await RobloxMods.toggleHighRes(!settings.fixResolution);

	if (settings.areModsEnabled && settings.fixResolution) {
		await updateBootstrapper('bootstrapper:text', { text: 'Optimizing resolution settings...' });
		await updateBootstrapper('bootstrapper:progress', { progress: 70 });
		if (allowFixedDelays) await sleep(350);
		await sleep(500);
	}

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

	if ((await getValue('integrations.rpc.enabled')) === true) RPCController.preset('inRobloxApp');

	robloxInstance.on('gameEvent', onGameEvent);
	robloxInstance.on('exit', async () => {
		console.info('[Launch] Roblox instance exited');
		if (settings.returnToWebsite) os.open('https://www.roblox.com');
		RobloxMods.restoreRobloxFolders(settings.areModsEnabled).catch(console.error);
		RobloxMods.toggleHighRes(true);
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
		console.info('[Launch] Preparing to launch Roblox...');

		const fflags = await validateFlags(showFlagErrorPopup, checkFlags);

		if (!robloxUrl) await neuWindow.hide();
		await setupBootstrapper();

		await updateBootstrapper('bootstrapper:text', { text: 'Checking Roblox installation...' });
		await updateBootstrapper('bootstrapper:progress', { progress: 10 });
		if (allowFixedDelays) await sleep(250);

		if (!(await RobloxUtils.hasRoblox())) {
			console.info('[Launch] Roblox is not installed. Exiting launch process.');
			await cleanupBootstrapper();
			await neuWindow.show();
			setLaunchingRoblox(false);
			return;
		}

		const robloxPath = await getMostRecentRoblox();
		await prepareRobloxSettings(robloxPath, fflags);

		try {
			const robloxInstance = await applyModsAndLaunch(settings, robloxUrl);
			await setupRobloxInstance(robloxInstance, settings, handlers);

			setTimeout(async () => {
				await shellFS.remove(path.join(robloxPath, 'Contents/MacOS/ClientSettings/'));
			}, 1500);
		} catch (err) {
			await RobloxMods.restoreRobloxFolders(settings.areModsEnabled).catch(console.error);
			console.error(err);
			toast.error('An error occurred while starting Roblox.');
			await shellFS.remove(path.join(robloxPath, 'Contents/MacOS/ClientSettings/'));
			await RobloxMods.toggleHighRes(true);

			await cleanupBootstrapper();
			setLaunchingRoblox(false);
			await neuWindow.show();
			return;
		}
	} catch (err) {
		console.error('[Launch] Critical error during launch sequence:', err);
		await cleanupBootstrapper();
		await neuWindow.show();
		focusWindow();
		setLaunchingRoblox(false);
		setRobloxConnected(false);
		toast.error('Failed to launch Roblox due to a critical error.');
	}
}
