import { os } from '@neutralinojs/lib';
import beautify from 'json-beautify';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import Roblox from '.';
import { getValue } from '../../components/settings';
import { showNotification } from '../tools/notifications';
import { RPCController } from '../tools/rpc';
import { shell } from '../tools/shell';
import shellFS from '../tools/shellfs';
import { focusWindow, setWindowVisibility } from '../window';
import onGameEvent from './events';
import { RobloxInstance } from './instance';

let rbxInstance: RobloxInstance | null = null;

/** Launches a Roblox instance */
export async function launchRoblox(
	setRobloxConnected: (value: boolean) => void,
	setLaunchingRoblox: (value: boolean) => void,
	setLaunchProgress: (value: number) => void,
	setLaunchText: (value: string) => void,
	showFlagErrorPopup: (title: string, description: string, code: string) => Promise<boolean>,
	robloxUrl?: string
) {
	if (rbxInstance || (await os.execCommand('pgrep -f "RobloxPlayer"')).stdOut.trim().length > 2) {
		setLaunchText('Roblox is already open');
		setLaunchingRoblox(false);
		toast.error('Due to technical reasons, you must close all instances of Roblox before launching from AppleBlox.');
		return;
	}
	// We use multiple functions as argument so things like launchProgress, the text to show in the UI, etc... can be read by App.svelte
	try {
		console.info('[Launch] Launching Roblox');
		setLaunchingRoblox(true);
		if (!(await Roblox.Utils.hasRoblox())) {
			console.info('[Launch] Roblox is not installed. Exiting launch process.');
			setLaunchingRoblox(false);
			return;
		}

		// Fast Flags
		setLaunchProgress(20);
		if (await shellFS.exists(path.join(Roblox.path, 'Contents/MacOS/ClientSettings/ClientAppSettings.json'))) {
			console.info(
				`[Launch] Removing current ClientAppSettings.json file in "${path.join(Roblox.path, 'Contents/MacOS/ClientSettings/ClientAppSettings.json"')}`
			);
			await shellFS.remove(path.join(Roblox.path, 'Contents/MacOS/ClientSettings/'));
			setLaunchText('Removing current ClientAppSettings...');
		}

		setLaunchProgress(30);
		setLaunchText('Copying fast flags...');
		console.info('[Launch] Copying fast flags...');
		await shellFS.createDirectory(path.join(Roblox.path, 'Contents/MacOS/ClientSettings'));
		console.info('[Launch] Parsing saved FFlags...');
		const presetFlags = await Roblox.FFlags.parseFlags(true);
		// Invalid presets
		if (
			Object.keys(presetFlags.invalidFlags).length > 0 &&
			(await getValue('fastflags.advanced.ignore_flags_warning')) === false
		) {
			const isIgnored = await showFlagErrorPopup(
				'Outdated presets',
				"The following flag presets have been removed from Roblox and won't work. To fix this issue, update to the latest version of the app (if you're not already on it) or wait for a fix to be released.",
				presetFlags.nameMap.join(', ')
			);
			if (!isIgnored) {
				setLaunchingRoblox(false);
				setRobloxConnected(false);
				return;
			}
		}
		const editorFlags = await Roblox.FFlags.parseFlags(false);
		// Invalid selected profile flags
		if (
			Object.keys(editorFlags.invalidFlags).length > 0 &&
			(await getValue('fastflags.advanced.ignore_flags_warning')) === false
		) {
			const isIgnored = await showFlagErrorPopup(
				'Invalid selected profile flags',
				"You have one or several flags that don't exist in your selected profile:",
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
				'Invalid game profiles flags',
				"You have one or several flags that don't exist in the following profiles:",
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
		await shellFS.writeFile(
			path.join(Roblox.path, 'Contents/MacOS/ClientSettings/ClientAppSettings.json'),
			JSON.stringify(fflags)
		);
		console.info(
			`[Launch] Wrote FFlags to "${path.join(Roblox.path, 'Contents/MacOS/ClientSettings/ClientAppSettings.json')}"`
		);

		// Mods
		if ((await getValue('mods.general.enabled')) === true) {
			setLaunchProgress(40);
			setLaunchText('Copying Mods...');

			await Roblox.Mods.copyToFiles();
		}
		await Roblox.Mods.applyCustomFont();

		setLaunchProgress(60);
		setTimeout(async () => {
			try {
				if ((await getValue('mods.general.fix_res')) === true) {
					const maxRes = (
						await shell("system_profiler SPDisplaysDataType | grep Resolution | awk -F': ' '{print $2}'")
					).stdout
						.trim()
						.split(' ');
					await Roblox.Window.setDesktopRes(maxRes[0], maxRes[2], 5);
					showNotification({
						title: 'Resolution changed',
						content: "Your resolution was temporarily changed (5s) by the 'Fix Resolution' setting.",
						timeout: 10,
					});
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
					console.info('[Launch] Roblox exited');
					if ((await getValue('mods.general.enabled')) === true) {
						await Roblox.Mods.restoreRobloxFolders()
							.catch(console.error)
							.then(() => {
								console.info(
									`[Launch] Removed mod files from "${path.join(Roblox.path, 'Contents/Resources/')}"`
								);
							});
					}
					await Roblox.Mods.removeCustomFont();
					RPCController.stop();
					setWindowVisibility(true);
					focusWindow();
					setRobloxConnected(false);
					rbxInstance = null;
				});
			} catch (err) {
				if ((await getValue('mods.general.enabled')) === true) {
					await Roblox.Mods.restoreRobloxFolders()
						.catch(console.error)
						.then(() => {
							console.info(`[Launch] Removed mod files from "${path.join(Roblox.path, 'Contents/Resources/')}"`);
						});
				}
				console.error(err);
				setLaunchingRoblox(false);
				toast.error('An error occured while starting Roblox.');
				await shellFS.remove(path.join(Roblox.path, 'Contents/MacOS/ClientSettings/'));
				console.info(`[Launch] Deleted "${path.join(Roblox.path, 'Contents/MacOS/ClientSettings/')}"`);
				return;
			}

			setLaunchProgress(100);
			setLaunchText('Roblox Launched');
			setWindowVisibility(false);
			setTimeout(() => {
				setLaunchingRoblox(false);
				shellFS.remove(path.join(Roblox.path, 'Contents/MacOS/ClientSettings/'));
				console.info(`[Launch] Deleted "${path.join(Roblox.path, 'Contents/MacOS/ClientSettings')}"`);
			}, 1000);
		}, 1000);
	} catch (err) {
		console.error('[Launch] An error occured while launching Roblox');
		console.error(err);
		setLaunchingRoblox(false);
		setRobloxConnected(false);
	}
}
