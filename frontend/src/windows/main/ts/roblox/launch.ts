import beautify from 'json-beautify';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import { getValue } from '../../components/settings';
import { Notification } from '../tools/notifications';
import { RPCController } from '../tools/rpc';
import { shell } from '../tools/shell';
import shellFS from '../tools/shellfs';
import { focusWindow, setWindowVisibility } from '../window';
import onGameEvent from './events';
import { RobloxFFlags } from './fflags';
import { RobloxInstance } from './instance';
import { RobloxMods } from './mods';
import { robloxPath } from './path';
import { RobloxUtils } from './utils';
import { events, os } from '@neutralinojs/lib';

let rbxInstance: RobloxInstance | null = null;

/** Launches a Roblox instance */
export async function launchRoblox(
	// We use multiple functions as argument so things like launchProgress, the text to show in the UI, etc... can be read by App.svelte
	setRobloxConnected: (value: boolean) => void,
	setLaunchingRoblox: (value: boolean) => void,
	setLaunchProgress: (value: number) => void,
	setLaunchText: (value: string) => void,
	showFlagErrorPopup: (title: string, description: string, code: string) => Promise<boolean>,
	robloxUrl?: string
) {
	// Constant settings
	const constSettings = {
		areModsEnabled: (await getValue<boolean>('mods.general.enabled')) === true,
		fixResolution: (await getValue<boolean>('mods.general.fix_res')) === true,
		returnToWebsite: (await getValue<boolean>('roblox.behavior.return_to_website')) === true,
		closeOnExit: (await getValue<boolean>('roblox.behavior.close_on_exit')) === true,
	};

	if (rbxInstance) {
		setLaunchText('Roblox is already open');
		setLaunchingRoblox(false);
		toast.error('You are already running an instance from AppleBlox.');
		return;
	}
	if ((await shell('pgrep', ['-f', 'RobloxPlayer'], { skipStderrCheck: true })).stdOut.trim().length > 3) {
		await shell('pkill', ['-9', '-f', 'RobloxPlayer'], { skipStderrCheck: true });
	}
	try {
		console.info('[Launch] Launching Roblox');
		setLaunchingRoblox(true);
		if (!(await RobloxUtils.hasRoblox())) {
			console.info('[Launch] Roblox is not installed. Exiting launch process.');
			setLaunchingRoblox(false);
			return;
		}

		// Fast Flags
		setLaunchProgress(20);
		if (await shellFS.exists(path.join(robloxPath, 'Contents/MacOS/ClientSettings/ClientAppSettings.json'))) {
			console.info(
				`[Launch] Removing current ClientAppSettings.json file in "${path.join(robloxPath, 'Contents/MacOS/ClientSettings/ClientAppSettings.json"')}`
			);
			await shellFS.remove(path.join(robloxPath, 'Contents/MacOS/ClientSettings/'));
			setLaunchText('Removing current ClientAppSettings...');
		}

		setLaunchProgress(30);
		setLaunchText('Copying fast flags...');
		console.info('[Launch] Copying fast flags...');
		await shellFS.createDirectory(path.join(robloxPath, 'Contents/MacOS/ClientSettings'));
		console.info('[Launch] Parsing saved FFlags...');
		const presetFlags = await RobloxFFlags.parseFlags(true);
		// Invalid presets
		if (
			Object.keys(presetFlags.invalidFlags).length > 0
		) {
			const isIgnored = await showFlagErrorPopup(
				'Outdated presets',
				'You are using outdated flags presets. The presets listed here may not work correctly. If you are on the latest version of the app, you just have to wait for a fix, otherwise, update to the latest version.',
				presetFlags.nameMap.join(', ')
			);
			if (!isIgnored) {
				setLaunchingRoblox(false);
				setRobloxConnected(false);
				return;
			}
		}
		const editorFlags = await RobloxFFlags.parseFlags(false);
		// Invalid selected profile flags
		if (
			Object.keys(editorFlags.invalidFlags).length > 0
		) {
			const isIgnored = await showFlagErrorPopup(
				'Invalid flags in selected profile',
				'You have one or several invalid flags in your selected profile:',
				beautify(editorFlags.invalidFlags, null, 2, 100)
			);
			if (!isIgnored) {
				setLaunchingRoblox(false);
				setRobloxConnected(false);
				return;
			}
		}
		// Invalid game profile flags
		if (
			editorFlags.invalidProfileFlags &&
			editorFlags.invalidProfileFlags.length > 0 &&
			(await getValue('fastflags.advanced.ignore_flags_warning')) === false
		) {
			const isIgnored = await showFlagErrorPopup(
				'Invalid flags in game profile(s)',
				'You have one or several invalid flags in the following profiles:',
				editorFlags.invalidProfileFlags
					.map((profile) => `${profile.name.toUpperCase()}:\n ${beautify(profile.flags, null, 2, 100)}`)
					.join('<br><br>')
			);
			if (!isIgnored) {
				setLaunchingRoblox(false);
				setRobloxConnected(false);
				return;
			}
		}
		const fflags = {
			...editorFlags.validFlags,
			...editorFlags.invalidFlags,
			...presetFlags.validFlags,
			...presetFlags.invalidFlags,
		};
		console.info('[Launch] FastFlags: ', fflags);
		console.info('[Launch] Preset flags:', { ...presetFlags.validFlags, ...presetFlags.invalidFlags });
		console.info('[Launch] Custom flags:', { ...editorFlags.validFlags, ...editorFlags.invalidFlags });
		await shellFS.writeFile(
			path.join(robloxPath, 'Contents/MacOS/ClientSettings/ClientAppSettings.json'),
			JSON.stringify(fflags)
		);
		console.info(
			`[Launch] Wrote FFlags to "${path.join(robloxPath, 'Contents/MacOS/ClientSettings/ClientAppSettings.json')}"`
		);

		// Mods
		if (constSettings.areModsEnabled) {
			setLaunchProgress(40);
			setLaunchText('Copying Mods...');

			await RobloxMods.copyToFiles();
		}
		await RobloxMods.applyCustomFont();

		setLaunchProgress(60);
		setTimeout(async () => {
			try {
				await RobloxMods.toggleHighRes(!constSettings.fixResolution);
				if (constSettings.areModsEnabled && constSettings.fixResolution) {
					setLaunchText('Disabling Retina resolution...');
					setLaunchProgress(80);
				}
				const robloxInstance = new RobloxInstance(true);
				await robloxInstance.init();
				await robloxInstance.start(robloxUrl);
				setRobloxConnected(true);
				rbxInstance = robloxInstance;

				if ((await getValue('integrations.rpc.enabled')) === true) {
					RPCController.preset('inRobloxApp');
				}

				robloxInstance.on('gameEvent', onGameEvent);
				robloxInstance.on('exit', async () => {
					console.info('[Launch] Roblox instance exited');
					if (constSettings.returnToWebsite) os.open('https://www.roblox.com');
					if (constSettings.areModsEnabled) {
						RobloxMods.restoreRobloxFolders()
							.catch(console.error)
							.then(async () => {
								console.info(`[Launch] Removed mod files from "${path.join(robloxPath, 'Contents/Resources/')}"`);
								// Use if block because checking if high resolution is enabled require file operations, so it's more optimized that way.
								await RobloxMods.toggleHighRes(true);
								await RobloxMods.removeCustomFont();
							});
					}
					RPCController.stop();
					setWindowVisibility(true);
					focusWindow();
					setRobloxConnected(false);
					rbxInstance = null;
					if (constSettings.closeOnExit) events.broadcast('exitApp');
				});
			} catch (err) {
				if (constSettings.areModsEnabled) {
					await RobloxMods.restoreRobloxFolders()
						.catch(console.error)
						.then(() => {
							console.info(`[Launch] Removed mod files from "${path.join(robloxPath, 'Contents/Resources/')}"`);
						});
				}
				console.error(err);
				setLaunchingRoblox(false);
				toast.error('An error occured while starting Roblox.');
				await shellFS.remove(path.join(robloxPath, 'Contents/MacOS/ClientSettings/'));
				console.info(`[Launch] Deleted "${path.join(robloxPath, 'Contents/MacOS/ClientSettings/')}"`);
				await RobloxMods.toggleHighRes(true);
				return;
			}

			setLaunchProgress(100);
			setLaunchText('Roblox Launched');
			setWindowVisibility(false);
			setTimeout(() => {
				setLaunchingRoblox(false);
				shellFS.remove(path.join(robloxPath, 'Contents/MacOS/ClientSettings/'));
				console.info(`[Launch] Deleted "${path.join(robloxPath, 'Contents/MacOS/ClientSettings')}"`);
			}, 1000);
		}, 1000);
	} catch (err) {
		console.error('[Launch] An error occured while launching Roblox');
		console.error(err);
		setLaunchingRoblox(false);
		setRobloxConnected(false);
	}
}
