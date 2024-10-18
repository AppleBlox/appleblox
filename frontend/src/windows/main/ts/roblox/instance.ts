import { events, filesystem, os } from '@neutralinojs/lib';
import path from 'path-browserify';
import { getValue } from '../../components/settings';
import { libraryPath } from '../libraries';
import { Notification } from '../tools/notifications';
import { buildCommand, shell, spawn, type SpawnEventEmitter } from '../tools/shell';
import { isProcessAlive, sleep } from '../utils';
import { RobloxDelegate } from './delegate';
import { robloxPath } from './path';
import { RobloxUtils } from './utils';

// Export value to be able to set it from other code
let restartWatcher = false;

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
	// Where we store the events and their handlers
	private events: { [key: string]: EventHandler[] } = {};
	private gameInstance: number | null = null;
	private latestLogPath: string | null = null;
	private logsInstance: SpawnEventEmitter | null = null;
	private isWatching = false;

	/** Adds a handler to an event */
	public on(event: Event, handler: EventHandler) {
		if (!this.events[event]) {
			this.events[event] = [];
		}
		this.events[event].push(handler);
	}

	/** Removes a handler of an event */
	public off(event: Event, handler: EventHandler) {
		if (!this.events[event]) return;

		const index = this.events[event].indexOf(handler);
		if (index !== -1) {
			this.events[event].splice(index, 1);
		}
	}

	/** Emits an event */
	public emit(event: Event, data?: any) {
		if (!this.events[event]) return;
		this.events[event].forEach((handler) => handler(data));
	}

	watchLogs: boolean;
	constructor(watch: boolean) {
		this.watchLogs = watch;
	}

	/** Initalize class values */
	public async init() {
		if (!(await RobloxUtils.hasRoblox())) return;
	}

	/** Starts the Roblox Instance */
	public async start(url?: string) {
		if (this.gameInstance) throw new Error('An instance is already running');

		console.info('[Roblox.Instance] Opening Roblox instance');

		// Launch Roblox
		if (url) {
			await RobloxDelegate.toggle(false);
			await shell('open', [url]);
		} else {
			await shell('open', [robloxPath]);
		}

		await sleep(1000); // Give time for Roblox to open
		// "If block" because settings can be edited and maybe it will not be boolean
		if ((await getValue<boolean>('roblox.behavior.delegate')) === true) {
			await RobloxDelegate.toggle(true);
		}

		// We find every roblox processes and get the RobloxPlayer one
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
			this.emit('exit');
			this.quit();
		};

		events.off('instance:quit', quitEventHandler);
		events.on('instance:quit', quitEventHandler);

		restartWatcher = true;
		this.isWatching = true;
		if (this.watchLogs) {
			await this.setupLogsWatcher().catch(async (err) => {
				console.error("[Roblox.Instance] Couldn't start logs watcher:", err);
				new Notification({
					title: 'Unable to start Roblox',
					content: 'AppleBlox was unable to monitor your logs due to an error. Roblox has been closed.',
				}).show();
				await this.quit();
				return;
			});
		}

		const intervalId = setInterval(async () => {
			// Check if instance is still alive
			if (this.gameInstance && !(await isProcessAlive(this.gameInstance))) {
				this.emit('exit');
				await this.cleanup();
				console.info('[Roblox.Instance] Instance is null, stopping.');
				clearInterval(intervalId);
			}
		}, 500);
	}

	private async setupLogsWatcher() {
		// Find the latest log file, if it exceeds 10 tries, abort launch.
		const logsDirectory = path.join(await os.getEnv('HOME'), 'Library/Logs/Roblox');
		let tries = 10;
		while (this.latestLogPath == null) {
			if (tries < 1) {
				throw new Error(`Couldn't find a .log file created less than 3 seconds ago in "${logsDirectory}". Stopping.`);
			}
			const latestFile = (
				await shell(`cd "${logsDirectory}" && ls -t | head -1`, [], { completeCommand: true })
			).stdOut.trim();
			const latestFilePath = path.join(logsDirectory, latestFile);
			const createdAt = (await filesystem.getStats(latestFilePath)).createdAt;
			const timeDifference = (Date.now() - createdAt) / 1000;
			if (timeDifference < 3) {
				console.info(`[Roblox.Instance] Found latest log file: "${latestFilePath}"`);
				this.latestLogPath = latestFilePath;
			} else {
				tries--;
				console.info(
					`[Roblox.Instance] Couldn't find a .log file created less than 3 seconds ago in "${logsDirectory}" (${tries}). Retrying in 1 second.`
				);
				await sleep(1000);
			}
		}

		// Sleep 3 seconds, "just in case"
		await sleep(3000);

		// Read the first content to not miss anything (We use iconv to make sure there is no non-UTF8 chars)
		shell(`iconv -f utf-8 -t utf-8 -c "${this.latestLogPath}" > /tmp/roblox_ablox.log`, [], { completeCommand: true }).then(
			() => {
				console.info('[Roblox.Instance] Converted first logs content');
				shell('cat', ['/tmp/roblox_ablox.log']).then((result) => {
					console.info('[Roblox.Instance] Processing first logs content');
					this.processLines(result.stdOut.trim().split('\n'));
				});
			}
		);

		let lastNotificationTime: null | number = null; // Store the UNIX time at which the last errror notification was created, to prevent spam
		const stdOutHandler = async (data: string) => {
			if (!this.isWatching) return;
			try {
				if (this.watchLogs === false) {
					console.info('[Roblox.Instance] watchLogs is false. Killing logs watcher.');
					restartWatcher = false;
					await shell('kill', ['-9', this.logsInstance?.pid || ''], { skipStderrCheck: true });
				}

				// Check if stdOut contains a message
				if (data.trim().startsWith('message:')) {
					console.warn('[Roblox.Instance] Roblox logs watcher said:', data.trim().slice(8));
					return;
				}

				const dataLines = data.trim().split('\n');
				let lines: string[] = [];
				for (const line of dataLines) {
					try {
						lines.push(...JSON.parse(line));
					} catch {
						// Invalid JSON so we skip
					}
				}
				this.processLines(lines);
			} catch (err) {
				if (lastNotificationTime == null || Date.now() - lastNotificationTime >= 10_000) {
					lastNotificationTime = Date.now();
					new Notification({
						title: 'An error occured',
						content: "AppleBlox wasn't able to read Roblox's logs.",
						sound: 'basso',
						timeout: 5,
					}).show();
					console.error(data);
					console.error("[Roblox.Instance] Couldn't read Roblox logs:", err);
				}
			}
		};
		const stdErrHandler = async (data: string) => {
			console.error('Logs watcher stdErr:', data);
		};
		const exitHandler = async (code: number) => {
			if (!restartWatcher) return;
			console.warn(`[Roblox.Instance] Logs watcher exited with code "${code}". Restarting.`);
			if (!this.latestLogPath) {
				console.error('[Roblox.Instance] latestLogPath was undefined. Unable to restart logs watcher. Exiting.');
				new Notification({
					title: 'Roblox monitoring stopped',
					content: 'A problem occured. AppleBlox has stopped monitoring your game.',
					sound: 'basso',
					timeout: 8,
				});
				await this.cleanup();
				return;
			}
			// Rebind watcher
			await this.startLogsWatcher(this.latestLogPath, stdOutHandler, exitHandler, stdErrHandler);
		};
		// Setup watcher for the first time
		await this.startLogsWatcher(this.latestLogPath, stdOutHandler, exitHandler, stdErrHandler);
		// this.processLines(content.split('\n'));
	}

	private async startLogsWatcher(
		logsPath: string,
		stdOutHandler?: (data: string) => void,
		exitHandler?: (code: number) => void,
		stdErrHandler?: (data: string) => void
	) {
		// Killing existing watchers
		console.info('[Roblox.Instance] Starting logs watcher: Killing existing ones...');
		restartWatcher = false;
		// Why kill and not peace ;)?
		await shell('pkill', ['-f', 'rlogs_ablox'], { skipStderrCheck: true });
		await sleep(500);

		// Launching process
		this.logsInstance = await spawn(libraryPath('rlogs'), [logsPath]);
		// os.spawnProcess(buildCommand(libraryPath('rlogs'), [logsPath]));
		if (stdOutHandler) {
			this.logsInstance.off('stdOut', stdOutHandler);
			this.logsInstance.on('stdOut', stdOutHandler);
		}
		if (exitHandler) {
			this.logsInstance.off('exit', exitHandler);
			this.logsInstance.on('exit', exitHandler);
		}
		if (stdErrHandler) {
			this.logsInstance.off('stdErr', stdErrHandler);
			this.logsInstance.on('stdErr', stdErrHandler);
		}
		console.info(
			'[Roblox.Instance] Using this command to start logs watcher:',
			buildCommand(libraryPath('rlogs'), [logsPath])
		);
		console.info(`[Roblox.Instance] Started logs watcher with PID: ${this.logsInstance.pid}`);
		restartWatcher = true;
	}

	private processLines(lines: string[]) {
		for (const entry of Entries) {
			const includedLines = lines.filter((line) => line.includes(entry.match));
			for (const line of includedLines) {
				this.emit('gameEvent', { event: entry.event, data: line });
			}
		}

		for (const pattern of Patterns) {
			const matchedLines = lines.filter((line) => pattern.regex.test(line));
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
		// Kill logs watcher
		restartWatcher = false;
		await shell('pkill', ['-f', 'rlogs_ablox'], { skipStderrCheck: true });
		this.logsInstance = null;
	}

	/** Quits Roblox */
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
