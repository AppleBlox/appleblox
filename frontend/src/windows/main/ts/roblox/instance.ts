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
	private pollInterval: NodeJS.Timeout | null = null;
	private lastPollTime = 0;

	// Non-blocking 60fps configuration
	private readonly POLL_INTERVAL = 16.67; // 60fps (16.67ms)
	private readonly BATCH_SIZE = 32 * 1024; // 32KB max read per frame
	private readonly PROCESSING_QUEUE_SIZE = 10; // Max queued processing tasks

	// Performance monitoring
	private pollCount = 0;
	private lastPerformanceLog = 0;
	private readonly PERFORMANCE_LOG_INTERVAL = 5000; // Log performance stats every 5 seconds
	
	// Non-blocking processing queue
	private processingQueue: string[][] = [];
	private isProcessing = false;

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
			console.info(`[Roblox.Instance] Opening Roblox from URL.`);
		} else {
			await shell('open', ['-b', 'com.roblox.RobloxPlayer']); // Experimental voice chat fix (we launch by bundle id instead of using roblox's binary path)
			console.info(`[Roblox.Instance] Opening Roblox from path.`);
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
			const currentTime = performance.now();

			// Log performance stats every 5 seconds
			if (currentTime - this.lastPerformanceLog >= this.PERFORMANCE_LOG_INTERVAL) {
				const pollRate = this.pollCount / (this.PERFORMANCE_LOG_INTERVAL / 1000);
				console.debug(`[Roblox.Instance] Poll rate: ${pollRate.toFixed(1)}Hz, Queue size: ${this.processingQueue.length}`);
				this.pollCount = 0;
				this.lastPerformanceLog = currentTime;
			}

			// Only proceed if enough time has passed since last poll (60fps)
			if (currentTime - this.lastPollTime >= this.POLL_INTERVAL) {
				this.pollCount++;
				this.lastPollTime = currentTime;

				// Get file stats (fast operation)
				const stats = await filesystem.getStats(this.latestLogPath);

				// Check if file has new content
				if (stats.size > this.lastPosition) {
					// Calculate read size (limit to batch size for non-blocking behavior)
					const availableBytes = stats.size - this.lastPosition;
					const readSize = Math.min(availableBytes, this.BATCH_SIZE);

					// Read only the new content (limited batch size)
					const content = await filesystem.readFile(this.latestLogPath, {
						pos: this.lastPosition,
						size: readSize,
					});

					this.lastPosition += readSize;
					this.lastFileSize = stats.size;

					// Queue processing asynchronously (non-blocking)
					if (content.length > 0) {
						const lines = content.split('\n');
						this.queueProcessing(lines);
					}
				}
			}
		} catch (err) {
			console.error('[Roblox.Instance] Error checking log file:', err);
		}
	}

	private queueProcessing(lines: string[]) {
		// Add to queue, but limit queue size to prevent memory issues
		if (this.processingQueue.length < this.PROCESSING_QUEUE_SIZE) {
			this.processingQueue.push(lines);
		} else {
			console.warn('[Roblox.Instance] Processing queue full, dropping lines');
		}

		// Start processing if not already running
		if (!this.isProcessing) {
			this.processQueueAsync();
		}
	}

	private async processQueueAsync() {
		if (this.isProcessing) return;
		this.isProcessing = true;

		// Use requestIdleCallback or setTimeout to process during idle time
		const processNext = () => {
			if (this.processingQueue.length === 0) {
				this.isProcessing = false;
				return;
			}

			const lines = this.processingQueue.shift();
			if (lines) {
				this.processLines(lines);
			}

			// Continue processing in next tick (non-blocking)
			setTimeout(processNext, 0);
		};

		// Start processing in next tick
		setTimeout(processNext, 0);
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
				// Read initial content in chunks to avoid blocking
				const chunkSize = this.BATCH_SIZE;
				let position = 0;
				
				while (position < initialStats.size) {
					const readSize = Math.min(chunkSize, initialStats.size - position);
					const chunk = await filesystem.readFile(this.latestLogPath, {
						pos: position,
						size: readSize,
					});
					
					const lines = chunk.split('\n');
					this.queueProcessing(lines);
					
					position += readSize;
					
					// Yield control to prevent blocking
					await new Promise(resolve => setTimeout(resolve, 0));
				}

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
		this.lastPerformanceLog = performance.now();
		this.lastPollTime = performance.now();

		// Set up 60fps polling interval
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
				// Use setTimeout to make it non-blocking
				setTimeout(() => {
					this.checkForNewContent().catch(console.error);
				}, 0);
			}
		};

		events.off('watchFile', this.watchHandler);
		events.on('watchFile', this.watchHandler);
	}

	private processLines(lines: string[]) {
		try {
			// Process high-frequency events first (GameMessageEntry)
			const messageLines = lines.filter((line) => {
				const pattern = Patterns.find((p) => p.event === 'GameMessageEntry');
				return pattern?.regex.test(line);
			});

			for (const line of messageLines) {
				const pattern = Patterns.find((p) => p.event === 'GameMessageEntry');
				if (pattern) {
					const match = line.match(pattern.regex);
					if (match) {
						this.emit('gameEvent', {
							event: 'GameMessageEntry',
							data: match[0],
						});
					}
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
				for (const line of matchedLines) {
					const match = line.match(pattern.regex);
					if (match) {
						this.emit('gameEvent', { event: pattern.event, data: match[0] });
					}
				}
			}
		} catch (err) {
			console.error('[Roblox.Instance] Error processing lines:', err);
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

		// Clear processing queue
		this.processingQueue = [];
		this.isProcessing = false;

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