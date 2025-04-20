import { events, filesystem, os } from '@neutralinojs/lib';
import path from 'path-browserify';
import { getValue } from '../../components/settings';
import { Notification } from '../tools/notifications';
import { shell } from '../tools/shell';
import { isProcessAlive, sleep } from '../utils';
import { RobloxDelegate } from './delegate';
import { getMostRecentRoblox } from './path';
import { RobloxUtils } from './utils';

type EventHandler = (data?: any) => void;
type Event = 'exit' | 'gameInfo' | 'gameEvent';
export interface GameEventInfo {
	event: string;
	data: string;
}

interface Entry {
	event: string;
	match: string;
}

// code adapted from https://github.com/pizzaboxer/bloxstrap/blob/main/Bloxstrap/Integrations/ActivityWatcher.cs
const Entries: Entry[] = [
	{
		event: 'GameJoining',
		match: '[FLog::Output] ! Joining game',
	},
	{
		event: 'GameStartJoining',
		match: '[FLog::SingleSurfaceApp] launchUGCGameInternal',
	},
	{
		event: 'GameJoiningPrivateServer',
		match: '[FLog::GameJoinUtil] GameJoinUtil::joinGamePostPrivateServer',
	},
	{
		event: 'GameJoiningReservedServer',
		match: '[FLog::GameJoinUtil] GameJoinUtil::initiateTeleportToReservedServer',
	},
	{
		event: 'GameJoiningUDMUX',
		match: '[FLog::Network] UDMUX Address = ',
	},
	{
		event: 'GameJoined',
		match: '[FLog::Network] serverId:',
	},
	{
		event: 'GameDisconnected',
		match: '[FLog::Network] Time to disconnect replication data:',
	},
	{
		event: 'GameTeleporting',
		match: '[FLog::SingleSurfaceApp] initiateTeleport',
	},
	{
		event: 'GameMessage',
		match: '[FLog::Output] [BloxstrapRPC]',
	},
	{
		event: 'GameLeaving',
		match: '[FLog::SingleSurfaceApp] leaveUGCGameInternal',
	},
	{
		event: 'ReturnToLuaApp',
		match: '[FLog::SingleSurfaceApp] returnToLuaApp',
	},
];

interface Pattern {
	event: string;
	regex: RegExp;
}

const Patterns: Pattern[] = [
	{
		event: 'GameJoiningEntry',
		regex: /! Joining game '([0-9a-f\-]{36})' place ([0-9]+) at ([0-9\.]+)/g,
	},
	{
		event: 'GameJoiningUDMUX',
		regex: /UDMUX Address = ([0-9\.]+), Port = [0-9]+ \| RCC Server Address = ([0-9\.]+), Port = [0-9]+/g,
	},
	{
		event: 'GameJoinedEntry',
		regex: /serverId: ([0-9\.]+)\|[0-9]+/g,
	},
	{
		event: 'GameMessageEntry',
		regex: /\[BloxstrapRPC\] (.*)/g,
	},
	{
		event: 'GameCrashEntry',
		regex: /\[FLog::CrashReportLog\] (.*)/g,
	},
];

export class RobloxInstance {
	private events: { [key: string]: EventHandler[] } = {};
	private gameInstance: number | null = null;
	private latestLogPath: string | null = null;
	private watcherId: number | null = null;
	private isWatching = false;
	private lastPosition = 0;
	private lastFileSize = 0;
	private logsDirectory: string | null = null;
	private watchHandler: (evt: any) => void = () => {};
	private pollInterval: Timer | null = null;
	private lastPollTime = 0;

	// Polling configuration
	private readonly POLL_INTERVAL = 8; // ~120Hz (8.33ms)
	private readonly MIN_POLL_INTERVAL = 8; // Same as POLL_INTERVAL to maintain frequency

	// Performance monitoring
	private pollCount = 0;
	private lastPerformanceLog = 0;
	private readonly PERFORMANCE_LOG_INTERVAL = 5000; // Log performance stats every 5 seconds

	watchLogs: boolean;
	constructor(watch: boolean) {
		this.watchLogs = watch;
	}

	public on(event: Event, handler: EventHandler) {
		if (!this.events[event]) {
			this.events[event] = [];
		}
		this.events[event].push(handler);
	}

	public off(event: Event, handler: EventHandler) {
		if (!this.events[event]) return;
		const index = this.events[event].indexOf(handler);
		if (index !== -1) {
			this.events[event].splice(index, 1);
		}
	}

	public emit(event: Event, data?: any) {
		if (!this.events[event]) return;
		this.events[event].forEach((handler) => handler(data));
	}

	public async init() {
		if (!(await RobloxUtils.hasRoblox())) return;
	}

	public async start(url?: string) {
		if (this.gameInstance) throw new Error('An instance is already running');

		console.info('[Roblox.Instance] Opening Roblox instance');

		if (url) {
			await RobloxDelegate.toggle(false);
			await shell('open', [url]);
		} else {
			await shell('open', [await getMostRecentRoblox()]);
		}

		await sleep(1000);
		if ((await getValue<boolean>('roblox.behavior.delegate')) === true) {
			await RobloxDelegate.toggle(true);
		}

		const robloxProcess = (await shell('pgrep', ['-f', 'Roblox'])).stdOut.trim().split('\n');
		for (const pid of robloxProcess) {
			const info = (
				await shell(`ps -p ${pid} -o command=`, [], { completeCommand: true, skipStderrCheck: true })
			).stdOut.trim();
			if (info.length < 2) continue;
			const processFileName = path.basename(info);
			if (processFileName === 'RobloxPlayer') {
				this.gameInstance = Number.parseInt(pid);
			}
		}

		if (this.gameInstance == null) {
			throw new Error("Couldn't find the RobloxPlayer process. Exiting launch.");
		}

		const quitEventHandler = () => {
			events.off('instance:quit', quitEventHandler);
			this.emit('exit');
			this.quit();
		};

		events.off('instance:quit', quitEventHandler);
		events.on('instance:quit', quitEventHandler);

		this.isWatching = true;
		if (this.watchLogs) {
			await this.setupLogsWatcher().catch(async (err) => {
				console.error("[Roblox.Instance] Couldn't start logs watcher:", err);
				new Notification({
					title: 'Unable to start Roblox',
					content: 'AppleBlox was unable to monitor your logs due to an error. Roblox has been closed.',
					sound: 'hero',
				}).show();
				this.emit('exit');
				await this.quit();
				return;
			});
		}

		const intervalId = setInterval(async () => {
			if (this.gameInstance && !(await isProcessAlive(this.gameInstance))) {
				this.emit('exit');
				await this.cleanup();
				console.info('[Roblox.Instance] Instance is null, stopping.');
				clearInterval(intervalId);
			}
		}, 500);
	}

	private async checkForNewContent() {
		if (!this.isWatching || !this.latestLogPath) return;

		try {
			const currentTime = Date.now();

			// Log performance stats every 5 seconds
			if (currentTime - this.lastPerformanceLog >= this.PERFORMANCE_LOG_INTERVAL) {
				const pollRate = this.pollCount / (this.PERFORMANCE_LOG_INTERVAL / 1000);
				this.pollCount = 0;
				this.lastPerformanceLog = currentTime;
			}

			// Only proceed if enough time has passed since last poll
			if (currentTime - this.lastPollTime >= this.MIN_POLL_INTERVAL) {
				this.pollCount++;
				this.lastPollTime = currentTime;

				// Get file stats
				const stats = await filesystem.getStats(this.latestLogPath);

				// Check if file has new content
				if (stats.size > this.lastPosition) {
					// Read only the new content
					const content = await filesystem.readFile(this.latestLogPath, {
						pos: this.lastPosition,
						size: stats.size - this.lastPosition,
					});

					this.lastPosition = stats.size;
					this.lastFileSize = stats.size;

					// Process new content immediately
					const lines = content.split('\n');
					if (lines.length > 0) {
						this.processLines(lines);
					}
				}
			}
		} catch (err) {
			console.error('[Roblox.Instance] Error checking log file:', err);
		}
	}

	private async setupLogsWatcher() {
		this.logsDirectory = path.join(await os.getEnv('HOME'), 'Library/Logs/Roblox');
		let tries = 10;

		// Wait for log file to appear
		while (this.latestLogPath == null) {
			if (tries < 1) {
				throw new Error(
					`Couldn't find a .log file created less than 3 seconds ago in "${this.logsDirectory}". Stopping.`
				);
			}
			const latestFile = (
				await shell(`cd "${this.logsDirectory}" && ls -t | head -1`, [], { completeCommand: true })
			).stdOut.trim();
			const latestFilePath = path.join(this.logsDirectory, latestFile);
			const createdAt = (await filesystem.getStats(latestFilePath)).createdAt;
			const timeDifference = (Date.now() - createdAt) / 1000;
			if (timeDifference < 3) {
				console.info(`[Roblox.Instance] Found latest log file: "${latestFilePath}"`);
				this.latestLogPath = latestFilePath;
			} else {
				tries--;
				console.info(
					`[Roblox.Instance] Couldn't find a .log file created less than 3 seconds ago in "${this.logsDirectory}" (${tries}). Retrying in 1 second.`
				);
				await sleep(1000);
			}
		}

		// Read initial content immediately after finding the file
		try {
			const initialStats = await filesystem.getStats(this.latestLogPath);
			if (initialStats.size > 0) {
				const initialContent = await filesystem.readFile(this.latestLogPath);
				const initialLines = initialContent.split('\n');
				this.processLines(initialLines);

				// Set position after processing initial content
				this.lastPosition = initialStats.size;
				this.lastFileSize = initialStats.size;
			} else {
				this.lastPosition = 0;
				this.lastFileSize = 0;
			}
		} catch (err) {
			console.error('[Roblox.Instance] Error reading initial log content:', err);
			this.lastPosition = 0;
			this.lastFileSize = 0;
		}

		// Initialize performance monitoring
		this.pollCount = 0;
		this.lastPerformanceLog = Date.now();
		this.lastPollTime = Date.now();

		// Set up polling interval
		this.pollInterval = setInterval(() => {
			this.checkForNewContent().catch((err) => {
				console.error('[Roblox.Instance] Error in poll interval:', err);
			});
		}, this.POLL_INTERVAL);

		// Set up directory watcher as backup
		this.watcherId = await filesystem.createWatcher(this.logsDirectory);
		console.info(`[Roblox.Instance] Created directory watcher with ID: ${this.watcherId}`);

		this.watchHandler = async (evt: any) => {
			if (!this.isWatching || !this.latestLogPath || evt.detail.id !== this.watcherId) return;

			// Trigger immediate check if file changed
			if (evt.detail.path === this.latestLogPath) {
				await this.checkForNewContent();
			}
		};

		events.off('watchFile', this.watchHandler);
		events.on('watchFile', this.watchHandler);
	}

	private processLines(lines: string[]) {
		// Process high-frequency events first (GameMessageEntry)
		const messageLines = lines.filter((line) => Patterns.find((p) => p.event === 'GameMessageEntry')?.regex.test(line));

		for (const line of messageLines) {
			const match = line.match(Patterns.find((p) => p.event === 'GameMessageEntry')!.regex);
			if (match) {
				this.emit('gameEvent', {
					event: 'GameMessageEntry',
					data: match[0],
				});
			}
		}

		// Process other events
		for (const entry of Entries) {
			const includedLines = lines.filter((line) => line.includes(entry.match));
			for (const line of includedLines) {
				this.emit('gameEvent', { event: entry.event, data: line });
			}
		}

		// Process remaining pattern matches
		for (const pattern of Patterns) {
			// Skip GameMessageEntry as it's already processed
			if (pattern.event === 'GameMessageEntry') continue;

			const matchedLines = lines.filter((line) => pattern.regex.test(line));
			// if (pattern.event === 'GameJoinedEntry' && matchedLines.length > 0) {
			// }
			for (const line of matchedLines) {
				const match = line.match(pattern.regex);
				if (match) {
					this.emit('gameEvent', { event: pattern.event, data: match[0] });
				}
			}
		}
	}

	public async cleanup() {
		this.isWatching = false;
		this.gameInstance = null;
		this.watchLogs = false;

		// Clear polling interval
		if (this.pollInterval) {
			clearInterval(this.pollInterval);
			this.pollInterval = null;
		}

		if (this.watcherId) {
			try {
				await filesystem.removeWatcher(this.watcherId);
				events.off('watchFile', this.watchHandler);
			} catch (err) {
				console.error('[Roblox.Instance] Error removing file watcher:', err);
			}
			this.watcherId = null;
		}

		this.latestLogPath = null;
		this.lastPosition = 0;
		this.lastFileSize = 0;
		this.lastPollTime = 0;
		this.pollCount = 0;
		this.lastPerformanceLog = 0;
		this.logsDirectory = null;
	}

	public async quit(withoutRoblox = false) {
		if (this.gameInstance == null) throw new Error("The instance hasn't be started yet");
		const gameInstancePid = this.gameInstance;
		await this.cleanup();
		if (withoutRoblox) {
			console.info('[Roblox.Instance] Closing this instance');
		} else {
			console.info('[Roblox.Instance] Quitting Roblox');
			await shell('kill', ['-9', gameInstancePid]);
		}
	}
}
