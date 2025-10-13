import { libraryPath } from '../libraries';
import { shell } from '../tools/shell';
import Logger from '../utils/logger';

export class RobloxUpdates {
	/** Defines the state of background updates */
	static async setLaunchAgentState(enabled: boolean) {
		const installerScript = libraryPath('roblox_updates_manager');
		const running =
			(
				await shell(
					`launchctl print "gui/$(id -u)/ch.origaming.appleblox.roblox-updater" &>/dev/null && echo "true" || echo "false"`,
					[],
					{ completeCommand: true, skipStderrCheck: true }
				)
			).stdOut.trim() === 'true';
		if (enabled) {
			if (running) return;
			await shell(installerScript, ['install']);
			Logger.info('Installed Roblox background updates LaunchAgent');
			return;
		}
		if (!running) return;
		await shell(installerScript, ['uninstall']);
		Logger.info('Uninstalled Roblox background updates LaunchAgent');
	}
}
