import AppIcon from '@/assets/play.icns';
import { sleep } from '@/windows/main/ts/utils';
import { filesystem, os } from '@neutralinojs/lib';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import { shell } from '../tools/shell';
import shellFS from '../tools/shellfs';
import { detectRobloxPath } from './path';
import Logger from '@/windows/main/ts/utils/logger';

export class RobloxUtils {
	/** Checks if roblox is installed, and if not show a popup */
	static async hasRoblox(): Promise<boolean> {
		const robloxPath = await detectRobloxPath();
		if (robloxPath && (await shellFS.exists(robloxPath))) {
			return true;
		}
		return false;
	}

	/** Uses cli to check if any instance of roblox is open */
	static async isRobloxOpen() {
		const cmd = await shell('ps aux | grep "Roblox" | grep -v "grep"', [], { completeCommand: true, skipStderrCheck: true });
		return cmd.stdOut.includes('Roblox');
	}

	/** Returns a JSON object in the form of the ClientSettings.json file for the FFLags */

	static async enableMultiInstance() {
		try {
			if (!(await RobloxUtils.hasRoblox())) return;
			if (await RobloxUtils.isRobloxOpen()) {
				toast.info('Closing Roblox...', { duration: 1000 });
				Logger.info('Closing Roblox...');
				await shell('pkill', ['-9', 'Roblox'], { skipStderrCheck: true });
				await sleep(2000);
			}

			toast.info('Opening Roblox...', { duration: 1000 });
			Logger.info('Opening Roblox...');
			const robloxPath = await detectRobloxPath();
			if (!robloxPath) {
				throw new Error('Roblox installation not found.');
			}
			await shellFS.open(robloxPath);

			await sleep(1000);

			toast.info('Terminating all processes...', { duration: 1000 });
			Logger.info('Terminating all Roblox processes...');
			const result = await shell("ps aux | grep -i roblox | grep -v grep | awk '{print $2}' | xargs", [], {
				completeCommand: true,
				skipStderrCheck: true,
			});
			Logger.info('Termination result: ', result);
			const processes = result.stdOut.trim().split(' ');
			for (const proc of processes) {
				Logger.info(`Terminating Roblox Process (PID: ${proc})`);

				try {
					await shell('kill', ['-9', proc], { skipStderrCheck: true });
				} catch (err) {
					Logger.error(`Error terminating process ${proc}: ${err}`);
					toast.error(`Error terminating process ${proc}: ${err}`);
				}
			}

			toast.success('Multi-instance should now be working!');
		} catch (err) {
			toast.error('An error occured while enabling MultiInstance');
			Logger.error('An error occured while enabling MultiInstance');
			Logger.error(err);
		}
	}

	/** Creates a Launch shortcut where the user chooses */
	static async createShortcut() {
		const savePath = await os
			.showFolderDialog('Where should the shortcut be created?', {
				defaultPath: '/Applications/',
			})
			.catch(Logger.error);
		if (!savePath) {
			return;
		}
		if (await shellFS.exists(path.join(savePath, 'Play Roblox.app'))) {
			await filesystem.remove(path.join(savePath, 'Play Roblox.app'));
		}
		await filesystem.createDirectory(path.join(savePath, 'Play Roblox.app/Contents/MacOS'));
		await filesystem.createDirectory(path.join(savePath, 'Play Roblox.app/Contents/Resources'));
		await filesystem.writeFile(
			path.join(savePath, 'Play Roblox.app/Contents/Info.plist'),
			`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launch</string>
	<key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>CFBundleSupportedPlatforms</key>
    <array>
        <string>MacOSX</string>
    </array>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.games</string>
</dict>
</plist>`
		);
		const response = await fetch(AppIcon);
		const blob = await response.blob();
		await filesystem.writeBinaryFile(
			path.join(savePath, 'Play Roblox.app/Contents/Resources/icon.icns'),
			await blob.arrayBuffer()
		);
		await shellFS.writeFile(
			path.join(savePath, 'Play Roblox.app/Contents/MacOS/launch'),
			'#!/bin/bash\nopen appleblox://launch'
		);
		const shortcutPath = path.join(savePath, 'Play Roblox.app');
		await shellFS.chmod(path.join(shortcutPath, 'Contents/MacOS/launch'), '+x');
		toast.success(`Created a shortcut at "${shortcutPath}"`);
		await shellFS.open(shortcutPath, { reveal: true });
	}

	static async killAll() {
		await shell(`ps aux | grep -i Roblox | grep -v grep | awk '{print $2}' | xargs kill -9`, [], {
			completeCommand: true,
			skipStderrCheck: true,
		});
	}

	static async quit() {
		await shell(`osascript -e 'tell application "Roblox" to if it is running then quit'`, [], {
			completeCommand: true,
			skipStderrCheck: true,
		});
		while (
			(await shell('ps aux | grep RobloxPlayer | grep -v grep', [], { completeCommand: true })).stdOut.trim().length > 2
		) {
			await sleep(500);
		}
		return;
	}
}
