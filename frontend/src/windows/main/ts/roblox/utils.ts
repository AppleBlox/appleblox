import { toast } from 'svelte-sonner';
import { dataPath, loadSettings } from '../settings';
import { pathExists } from '../utils';
import { filesystem, os } from '@neutralinojs/lib';
import path from 'path-browserify';
import { sleep } from '@/windows/main/ts/utils';
import { getRobloxPath } from './path';
import AppIcon from '@/assets/play.icns';
import { libraryPath } from '../libraries';

export class RobloxUtils {
	/** Checks if roblox is installed, and if not show a popup */
	static async hasRoblox(popup = true): Promise<boolean> {
		if (await pathExists(path.join(getRobloxPath(), 'Contents/MacOS/RobloxPlayer'))) {
			return true;
		} else {
			if (!popup) return false;
			os.execCommand(`osascript <<'END'
    set theAlertText to "Roblox is not installed"
    set theAlertMessage to "To use AppleBlox, you first need to install Roblox. Would you like to open the download page?"
    display alert theAlertText message theAlertMessage as critical buttons {"Cancel", "Open link"} default button "Open link" cancel button "Cancel" giving up after 60
    set the button_pressed to the button returned of the result
    if the button_pressed is "Open link" then
        open location "https://roblox.com/download"
    end if
END`);
			return false;
		}
	}

	/** Uses cli to check if any instance of roblox is open */
	static async isRobloxOpen() {
		const cmd = await os.execCommand('ps aux | grep "Roblox" | grep -v "grep"');
		return cmd.stdOut.includes('Roblox');
	}

	/** Returns a JSON object in the form of the ClientSettings.json file for the FFLags */

	static async enableMultiInstance() {
		try {
			if (!(await this.hasRoblox())) return;
			if (await this.isRobloxOpen()) {
				toast.info('Closing Roblox...', { duration: 1000 });
				console.log('Closing Roblox');
				const robloxKill = await os.execCommand(`pkill -9 Roblox`);
				console.log(robloxKill);

				await sleep(2000);
			}

			toast.info('Opening Roblox...', { duration: 1000 });
			console.log('Opening Roblox');
			await os.execCommand(`open "${getRobloxPath()}"`, { background: true });

			await sleep(1000);

			toast.info('Terminating all processes...', { duration: 1000 });
			console.log('Terminating all Roblox processes');
			const result = await os.execCommand("ps aux | grep -i roblox | grep -v grep | awk '{print $2}' | xargs");
			console.log(result);
			const processes = result.stdOut.trim().split(' ');
			for (const proc of processes) {
				console.log(`Terminating Roblox Process (PID: ${proc})`);

				try {
					const cmd = await os.execCommand(`kill -9 ${proc}`);
					console.log(cmd);
				} catch (err) {
					console.error(`Error terminating process ${proc}: ${err}`);
					toast.error(`Error terminating process ${proc}: ${err}`);
				}
			}

			toast.success('Multi-instance should now be working!');
		} catch (err) {
			toast.error('An error occured while enabling MultiInstance');
			console.error('An error occured while enabling MultiInstance');
			console.error(err);
		}
	}

	/** Creates a Launch shortcut where the user chooses */
	static async createShortcut() {
		const savePath = await os.showFolderDialog('Where should the shortcut be created?', { defaultPath: '/Applications/' }).catch(console.error);
		if (!savePath) {
			return;
		}
		if (await pathExists(path.join(savePath, 'Launch Roblox.app'))) {
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
		await filesystem.writeBinaryFile(path.join(savePath, 'Launch Roblox.app/Contents/Resources/icon.icns'), await blob.arrayBuffer());
		await filesystem.writeFile(path.join(savePath, 'Launch Roblox.app/Contents/MacOS/launch'), '#!/bin/bash\n' + path.join(path.dirname(window.NL_PATH), 'MacOS/bootstrap') + ' --launch');
		await os.execCommand(`chmod +x ${path.join(savePath, 'Launch Roblox.app/Contents/MacOS/launch').replaceAll(' ', '\\ ')}`);
		toast.success(`Created a shortcut at "${path.join(savePath, 'Launch Roblox.app')}"`);
	}

	/** Toggles wether or not opening roblox:// and roblox-player:// links should open AppleBlox */
	static async toggleURI(state: boolean, notif = true) {
		const urlscheme = `${libraryPath('urlscheme')}`;
		if (state) {
			// await os.execCommand(`open "${libraryPath("urlhandler")}"`)
			await os.execCommand(`${urlscheme} set roblox ch.origaming.appleblox.url`);
			await os.execCommand(`${urlscheme} set roblox-player ch.origaming.appleblox.url`);
			if (notif) {
				toast.success('Replaced roblox URI');
			}
		} else {
			await os.execCommand(`${urlscheme} set roblox com.roblox.RobloxPlayer`);
			await os.execCommand(`${urlscheme} set roblox-player com.roblox.RobloxPlayer`);
			if (notif) {
				toast.success('Restored roblox URI');
			}
		}
	}
}
