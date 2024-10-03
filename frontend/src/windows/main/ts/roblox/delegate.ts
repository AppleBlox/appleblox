import { shell } from '../tools/shell';
import { getValue } from '../../components/settings';
import { libraryPath } from '../libraries';
import { toast } from 'svelte-sonner';

const urlscheme = libraryPath('urlscheme');

async function setUrlscheme(
	uri: string,
	bundleId: string
): Promise<{ toggled: true } | { toggled: false; stdErr: string; stdOut: string }> {
	const command = await shell(`${urlscheme}`, ['set', uri, bundleId], { skipStderrCheck: true });
	if (!command.stdout.includes('Successfully') && !command.stderr.includes('Successfully')) {
		return { toggled: false, stdErr: command.stderr, stdOut: command.stdout };
	}
	return { toggled: true };
}

export class RobloxDelegate {
	/** Checks if the app is already redirected */
	static async check(retoggle = false) {
		// If it's not active but toggled in settings, retoggle.
		const cmd = await shell(`${urlscheme}`, ['check', 'roblox-player', 'ch.origaming.appleblox'], { skipStderrCheck: true });
		const toggled = cmd.stdout.includes('true') || cmd.stderr.includes('true');
		if (!toggled && retoggle && (await getValue<boolean>('roblox.launching.delegate')) === true) {
			await this.toggle(true);
			return true;
		} else if (toggled && retoggle && (await getValue<boolean>('roblox.launching.delegate')) === false) {
			await this.toggle(false);
			return false;
		}
		return toggled;
	}

	/** Enable/disable delegation */
	static async toggle(delegate: boolean) {
		if (delegate) {
			const toggled = await setUrlscheme('roblox-player', 'ch.origaming.appleblox');
			if (!toggled.toggled) {
				toast.error("Couldn't set Roblox's URI");
				console.error("Couldn't set Roblox's URI:", toggled.stdErr, toggled.stdOut);
			}
		} else {
			const toggled = await setUrlscheme('roblox-player', 'com.roblox.RobloxPlayer');
			if (!toggled.toggled) {
				toast.error("Couldn't set Roblox's URI");
				console.error("Couldn't set Roblox's URI:", toggled.stdErr, toggled.stdOut);
			}
		}
	}
}
