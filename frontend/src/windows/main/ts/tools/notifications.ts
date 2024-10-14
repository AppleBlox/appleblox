import { getValue } from '../../components/settings';
import { libraryPath } from '../libraries';
import { buildCommand, spawn, type SpawnEventEmitter } from './shell';

/**
 * Represents an action that can be associated with a notification.
 */
export interface NotificationAction {
	/** The label displayed for the action. */
	label: string;
	/** The value returned when the action is selected. */
	value: string;
}

/**
 * Options for creating a notification.
 */
export interface NotificationOptions {
	/** The title of the notification. */
	title: string;
	/** The main content of the notification. */
	content: string;
	/** An optional group identifier for the notification. */
	group?: string;
	/** Whether to play a sound when showing the notification. */
	sound?: boolean;
	/** The duration in seconds for which the notification should be displayed. */
	timeout?: number;
	/** An optional subtitle for the notification. */
	subtitle?: string;
	/** Custom label for the close button. */
	closeLabel?: string;
	/** List of actions available for the notification. */
	actions?: NotificationAction[];
	/** Custom label for the actions dropdown. */
	dropdownLabel?: string;
	/** Path or URL to an image to use as the app icon. */
	appIcon?: string;
	/** Path or URL to an image to display in the notification. */
	contentImage?: string;
	/** Whether to show a reply input in the notification. */
	reply?: boolean;
}

/**
 * Represents a notification returned by the list function.
 */
export interface ListedNotification {
	/** The identifier of the notification. */
	identifier: string;
	/** The title of the notification. */
	title: string;
	/** The subtitle of the notification, if any. */
	subtitle?: string;
	/** The main message of the notification. */
	message: string;
	/** The delivery date of the notification. */
	deliveredAt: Date;
}

/**
 * Defines the structure of event handlers for different notification events.
 */
interface NotificationEventMap {
	clicked: () => void;
	closed: () => void;
	action: (action: NotificationAction) => void;
	replied: (reply: string) => void;
	timeout: () => void;
}

type EventHandler<T extends keyof NotificationEventMap> = NotificationEventMap[T];

/**
 * Represents a system notification with various interaction possibilities.
 */
export class Notification {
	private options: NotificationOptions;
	private process: SpawnEventEmitter | null = null;
	private eventListeners: { [K in keyof NotificationEventMap]: EventHandler<K>[] } = {
		clicked: [],
		closed: [],
		action: [],
		replied: [],
		timeout: [],
	};

	/**
	 * Creates a new Notification instance.
	 * @param options - The options for the notification.
	 */
	constructor(options: NotificationOptions) {
		this.options = options;
	}

	private emit<K extends keyof NotificationEventMap>(event: K, ...args: Parameters<EventHandler<K>>) {
		this.eventListeners[event].forEach((listener) => {
			(listener as Function)(...args);
		});
	}

	/**
	 * Adds an event listener to the notification.
	 * @param event - The event to listen for.
	 * @param listener - The callback function to execute when the event occurs.
	 * @returns The Notification instance for chaining.
	 */
	public on<K extends keyof NotificationEventMap>(event: K, listener: EventHandler<K>): this {
		this.eventListeners[event].push(listener);
		return this;
	}

	/**
	 * Removes an event listener from the notification.
	 * @param event - The event to stop listening for.
	 * @param listener - The callback function to remove.
	 * @returns The Notification instance for chaining.
	 */
	public off<K extends keyof NotificationEventMap>(event: K, listener: EventHandler<K>): this {
		// @ts-expect-error: can't manage to fix :(
		this.eventListeners[event] = this.eventListeners[event].filter((l) => l !== listener) as EventHandler<K>[];
		return this;
	}

	/**
	 * Displays the notification.
	 * @returns A promise that resolves when the notification process exits.
	 * @throws If there's an error showing the notification.
	 */
	public async show(): Promise<void> {
		try {
			if ((await getValue('misc.advanced.notify_all')) === true) {
				this.options.sound = true;
			}

			const alerter = libraryPath('notifications');

			const args = [
				'-message',
				this.options.content,
				'-title',
				this.options.title,
				'-sender',
				'ch.origaming.appleblox',
				...(this.options.group ? ['-group', this.options.group] : []),
				...(this.options.timeout ? ['-timeout', Math.floor(this.options.timeout).toString()] : []),
				...(this.options.sound ? ['-sound', 'default'] : []),
				...(this.options.subtitle ? ['-subtitle', this.options.subtitle] : []),
				...(this.options.closeLabel ? ['-closeLabel', this.options.closeLabel] : []),
				...(this.options.appIcon ? ['-appIcon', this.options.appIcon] : []),
				...(this.options.contentImage ? ['-contentImage', this.options.contentImage] : []),
				...(this.options.reply ? ['-reply'] : []),
			];

			if (this.options.actions && this.options.actions.length > 0) {
				args.push('-actions', this.options.actions.map((a) => a.label).join(','));
				if (this.options.dropdownLabel) {
					args.push('-dropdownLabel', this.options.dropdownLabel);
				}
			}

			this.process = await spawn(alerter, args);
			console.log(`Spawning notification: ${buildCommand(alerter,args)}`);

			this.process.on('stdOut', (data) => {
				const trimmedData = data.trim();
				switch (trimmedData) {
					case '@ACTIONCLICKED':
					case '@CONTENTCLICKED':
						this.emit('clicked');
						break;
					case '@CLOSED':
						this.emit('closed');
						break;
					case '@TIMEOUT':
						this.emit('timeout');
						break;
					default:
						if (trimmedData.startsWith('@REPLIED')) {
							const replyText = trimmedData.substring(9);
							this.emit('replied', replyText);
						} else if (this.options.actions) {
							const action = this.options.actions.find((a) => a.label === trimmedData);
							if (action) {
								this.emit('action', action);
							}
						}
				}
			});

			await this.process;
		} catch (err) {
			console.error('Error showing notification:', err);
			throw err;
		}
	}

	/**
	 * Lists active notifications.
	 * @param groupId - Optional group ID to filter notifications.
	 * @returns A promise that resolves with an array of ListedNotification objects.
	 * @throws If there's an error listing the notifications.
	 */
	public static async list(groupId: string = 'ALL'): Promise<ListedNotification[]> {
		const alerter = libraryPath('notifications');
		const notif = await spawn(alerter, ['-list', groupId, '-json']);

		return new Promise((resolve, reject) => {
			let output = '';
			notif.on('stdOut', (data) => {
				output += data;
			});
			notif.on('exit', (code) => {
				if (code === 0) {
					try {
						const parsedOutput = JSON.parse(output);
						const notifications: ListedNotification[] = parsedOutput.map((n: any) => ({
							identifier: n.identifier,
							title: n.title,
							subtitle: n.subtitle,
							message: n.message,
							deliveredAt: new Date(n.deliveredAt),
						}));
						resolve(notifications);
					} catch (err) {
						reject(new Error('Failed to parse notification list'));
					}
				} else {
					reject(new Error(`Failed to list notifications. Exit code: ${code}`));
				}
			});
		});
	}
}
