// Handles notifications in the app using the alerter binary
import { events, os } from '@neutralinojs/lib';
import { getValue } from '../../components/settings';
import { libraryPath } from '../libraries';
import { focusWindow } from '../window';

/**
 * Interface for notification options
 */
export interface NotificationOptions {
	/**
	 * The title of the notification
	 */
	title: string;

	/**
	 * The main content of the notification
	 */
	content: string;

	/**
	 * Optional. The group identifier for the notification.
	 * Notifications with the same group may be displayed together or replace each other.
	 */
	group?: string;

	/**
	 * Optional. Whether to play a sound when showing the notification.
	 * If not specified, the default is silent.
	 */
	sound?: boolean;

	/**
	 * Optional. The duration in seconds for which the notification should be displayed.
	 * If not specified, the system default duration will be used.
	 */
	timeout?: number;
}

/**
 * Shows a notification using the alerter binary
 * @param options - The notification options
 */
export async function showNotification(options: NotificationOptions): Promise<void> {
	try {
		if ((await getValue('misc.advanced.notify_all')) === true) {
			options.sound = true;
		}

		const alerter = libraryPath('notifications');

		const cmd = `${alerter} -message "${options.content}" -title "${options.title}" ${
			options.group ? `-group "${options.group}"` : ''
		} -sender "ch.origaming.appleblox" ${
			options.timeout ? `-timeout ${Math.floor(options.timeout)}` : ''
		} ${options.sound ? '-sound default' : ''}`;

		os.spawnProcess(cmd);
	} catch (err) {
		console.error(err);
	}
}

// Event listener for spawned notifications
events.on('spawnedProcess', (evt) => {
	// Check if the event is a stdout event
	if (evt.detail.action === 'stdOut') {
		// If the notification was clicked, focus the window
		if (evt.detail.data === '@ACTIONCLICKED') {
			focusWindow();
		}
	}
});
