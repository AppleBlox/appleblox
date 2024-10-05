import AppIcon from '@/assets/play.icns';
import { sleep } from '@/windows/main/ts/utils';
import { filesystem, os } from '@neutralinojs/lib';
import path from 'path-browserify';
import { toast } from 'svelte-sonner';
import Roblox from '.';
import { shell } from '../tools/shell';
import shellFS from '../tools/shellfs';

export class RobloxUtils {
	/** Checks if roblox is installed, and if not show a popup */
	static async hasRoblox(popup = true): Promise<boolean> {
		if (await shellFS.exists(path.join(Roblox.path, 'Contents/MacOS/RobloxPlayer'))) {
			return true;
		}
		if (!popup) return false;
		shell(
			`osascript <<'END'
    set theAlertText to "Roblox is not installed"
    set theAlertMessage to "To use AppleBlox, you first need to install Roblox. Would you like to open the download page?"
    display alert theAlertText message theAlertMessage as critical buttons {"Cancel", "Open link"} default button "Open link" cancel button "Cancel" giving up after 60
    set the button_pressed to the button returned of the result
    if the button_pressed is "Open link" then
        open location "https://roblox.com/download"
    end if
END`,
			[],
			{ completeCommand: true }
		);
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
				console.info('[Roblox.Utils] Closing Roblox...');
				await shell('pkill', ['-9', 'Roblox'],{skipStderrCheck: true});
				await sleep(2000);
			}

			toast.info('Opening Roblox...', { duration: 1000 });
			console.info('[Roblox.Utils] Opening Roblox...');
			await shellFS.open(Roblox.path);

			await sleep(1000);

			toast.info('Terminating all processes...', { duration: 1000 });
			console.info('[Roblox.Utils] Terminating all Roblox processes...');
			const result = await shell("ps aux | grep -i roblox | grep -v grep | awk '{print $2}' | xargs", [], {
				completeCommand: true,
				skipStderrCheck: true
			});
			console.info('[Roblox.Utils] Termination result: ', result);
			const processes = result.stdOut.trim().split(' ');
			for (const proc of processes) {
				console.info(`[Roblox.Utils] Terminating Roblox Process (PID: ${proc})`);

				try {
					await shell("kill",["-9",proc],{skipStderrCheck: true})
				} catch (err) {
					console.error(`[Roblox.Utils] Error terminating process ${proc}: ${err}`);
					toast.error(`Error terminating process ${proc}: ${err}`);
				}
			}

			toast.success('Multi-instance should now be working!');
		} catch (err) {
			toast.error('An error occured while enabling MultiInstance');
			console.error('[Roblox.Utils] An error occured while enabling MultiInstance');
			console.error(err);
		}
	}

	/** Creates a Launch shortcut where the user chooses */
	static async createShortcut() {
		const savePath = await os
			.showFolderDialog('Where should the shortcut be created?', {
				defaultPath: '/Applications/',
			})
			.catch(console.error);
		if (!savePath) {
			return;
		}
		if (await shellFS.exists(path.join(savePath, 'Launch Roblox.app'))) {
			await filesystem.remove(path.join(savePath, 'Launch Roblox.app'));
		}
		await filesystem.createDirectory(path.join(savePath, 'Launch Roblox.app/Contents/MacOS'));
		await filesystem.createDirectory(path.join(savePath, 'Launch Roblox.app/Contents/Resources'));
		await filesystem.writeFile(
			path.join(savePath, 'Launch Roblox.app/Contents/Info.plist'),
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
			path.join(savePath, 'Launch Roblox.app/Contents/Resources/icon.icns'),
			await blob.arrayBuffer()
		);
		await filesystem.writeFile(
			path.join(savePath, 'Launch Roblox.app/Contents/MacOS/launch'),
			`#!/bin/bash\n${path.join(path.dirname(window.NL_PATH), 'MacOS/bootstrap')} --launch`
		);
		await shellFS.chmod(path.join(savePath, 'Launch Roblox.app/Contents/MacOS/launch').replaceAll(' ', '\\ '),"+x")
		toast.success(`Created a shortcut at "${path.join(savePath, 'Launch Roblox.app')}"`);
	}

	static async killAll() {
		await shell(`ps aux | grep -i roblox | grep -v grep | awk '{print $2}' | xargs kill -9`,[],{completeCommand: true, skipStderrCheck: true});
	}

	static async quit() {
		await shell(`osascript -e 'tell application "Roblox" to if it is running then quit'`,[],{completeCommand: true, skipStderrCheck: true});
		while ((await shell('ps aux | grep RobloxPlayer | grep -v grep',[],{completeCommand: true})).stdOut.trim().length > 2) {
			await sleep(500);
		}
		return;
	}
}
