// Handles notifications in the app using the alerter binary
import { debug, events, os, window as w } from '@neutralinojs/lib';
import { libraryPath } from './libraries';
import { focusWindow } from './window';
import { loadSettings } from './settings';

export interface NotificationOptions {
	title: string;
	content: string;
	group?: string;
	sound?: boolean;
	timeout?: number;
}

export async function showNotification(options: NotificationOptions) {
	try {
		const miscSettings = await loadSettings('misc');
		if (miscSettings && miscSettings.advanced.notify_all) {
			options.sound = true;
		}
		const alerter = libraryPath('notifications');
		const cmd = `${alerter} -message "${options.content}" -title "${options.title}" ${options.group ? `-group "${options.group}"` : ''} -sender "ch.origaming.appleblox" ${
			options.timeout ? '-timeout ' + Math.floor(options.timeout) : ''
		} ${options.sound ? '-sound default' : ''}`;
		os.spawnProcess(cmd);
	} catch (err) {
		console.error(err);
	}
}

events.on('spawnedProcess', (evt) => {
	if (evt.detail.action === 'stdOut') {
		if (evt.detail.data === '@ACTIONCLICKED') {
			focusWindow();
		}
	}
});
