import { events, filesystem, os } from "@neutralinojs/lib";
import { hasRoblox } from "./utils";
import { isProcessAlive, removeNonUTF8CharactersFromString } from "../utils";
import { sleep } from "$lib/appleblox";
import path from "path-browserify";
import { getRobloxPath } from "./path";

type EventHandler = (data?: any) => void;
type Event = "exit" | "gameInfo" | "gameEvent";
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
		event: "GameJoining",
		match: "[FLog::Output] ! Joining game",
	},
	{
		event: "GameJoiningPrivateServer",
		match: "[FLog::GameJoinUtil] GameJoinUtil::joinGamePostPrivateServer",
	},
	{
		event: "GameJoiningReservedServer",
		match: "[FLog::GameJoinUtil] GameJoinUtil::initiateTeleportToReservedServer",
	},
	{
		event: "GameJoiningUDMUX",
		match: "[FLog::Network] UDMUX Address = ",
	},
	{
		event: "GameJoined",
		match: "[FLog::Network] serverId:",
	},
	{
		event: "GameDisconnected",
		match: "[FLog::Network] Time to disconnect replication data:",
	},
	{
		event: "GameTeleporting",
		match: "[FLog::SingleSurfaceApp] initiateTeleport",
	},
	{
		event: "GameMessage",
		match: "[FLog::Output] [BloxstrapRPC]",
	},
	{
		event: "GameLeaving",
		match: "[FLog::SingleSurfaceApp] leaveUGCGameInternal",
	},
];

interface Pattern {
	event: string;
	regex: RegExp;
}

const Patterns: Pattern[] = [
	{
		event: "GameJoiningEntry",
		regex: /! Joining game '([0-9a-f\-]{36})' place ([0-9]+) at ([0-9\.]+)/g,
	},
	{
		event: "GameJoiningUDMUX",
		regex: /UDMUX Address = ([0-9\.]+), Port = [0-9]+ \| RCC Server Address = ([0-9\.]+), Port = [0-9]+/g,
	},
	{
		event: "GameJoinedEntry",
		regex: /serverId: ([0-9\.]+)\|[0-9]+/g,
	},
	{
		event: "GameMessageEntry",
		regex: /\[BloxstrapRPC\] (.*)/g,
	},
	{
		event: "GameCrashEntry",
		regex: /\[FLog::CrashReportLog\] (.*)/g,
	},
];

export class RobloxInstance {
	// Where we store the events and their handlers
	private events: { [key: string]: EventHandler[] } = {};
	private gameInstance: number | null = null;
	private latestLogPath: string | null = null;

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
	robloxInstalled: boolean;
	constructor(watch: boolean) {
		this.watchLogs = watch;
		this.robloxInstalled = false;
	}

	/** Initalize class values */
	public async init() {
		if (await hasRoblox(false)) {
			this.robloxInstalled = true;
		}
	}

	/** Starts the Roblox Instance */
	public async start() {
		if (this.gameInstance) throw new Error("An instance is already running");

		console.log("Opening Roblox instance");
		await os.execCommand(`open "${getRobloxPath()}"`);

		await sleep(1000);

		const robloxProcess = await (await os.execCommand('pgrep -f "Roblox"')).stdOut.split("\n");
		for (const pid of robloxProcess) {
			const info = (await os.execCommand(`ps -p ${pid} -o command=`)).stdOut.trim();
			if (info.length < 2) continue;
			const processFileName = path.basename(info);
			if (processFileName === "RobloxPlayer") {
				this.gameInstance = parseInt(pid);
			}
		}

		if (this.gameInstance == null) {
			throw new Error("Couldn't find the RobloxPlayer process. Exiting launch.");
		}

		// Find the latest log file
		const logsDirectory = path.join(await os.getEnv("HOME"), "Library/Logs/Roblox");
		let tries = 10;
		while (this.latestLogPath == null) {
			if (tries < 1) {
				throw new Error(`Couldn't find a .log file created less than 15 seconds ago in "${logsDirectory}". Stopping.`)
			}
			const latestFile = (await os.execCommand(`cd "${logsDirectory}" && ls -t | head -1`)).stdOut.trim();
			const latestFilePath = path.join(logsDirectory, latestFile);
			const createdAt = (await filesystem.getStats(latestFilePath)).createdAt;
			const timeDifference = (Date.now() - createdAt) / 1000;
			if (timeDifference < 15) {
				console.log(`Found latest log: "${latestFilePath}"`)
				this.latestLogPath = latestFilePath;
			} else {
				tries--
				console.log(`Couldn't find a .log file created less than 15 seconds ago in "${logsDirectory}" (${tries}). Retrying in 1 second.`)
				await sleep(1000);
			}
		}

		let lastPosition = 0;
		const intervalId = setInterval(async () => {
			// Check if instance is still alive
			if (this.gameInstance && !(await isProcessAlive(this.gameInstance))) {
				this.gameInstance = null;
				this.emit("exit");
				console.log("Instance is null, stopping.");
				clearInterval(intervalId);
			}

			// Get the new lines
			try {
				// filesystem.readFile() cannot access this file, and we use iconv to remove non-utf8 characters that could make the program crash.
				await os.execCommand(`iconv -f utf-8 -t utf-8 -c "${this.latestLogPath}" > /tmp/roblox_ablox.log`);
				const content = (await os.execCommand(`cat /tmp/roblox_ablox.log`)).stdOut;
				if (content.length > lastPosition) {
					const newContent = content.slice(lastPosition);
					const newLines = newContent.split("\n").filter((line) => line.trim() !== "");
					this.processLines(newLines);
					lastPosition = content.length;
				}
			} catch (err) {
				console.error("Error while watching instance logs", err);
			}
		}, 500);
	}

	private processLines(lines: string[]) {
		for (const entry of Entries) {
			const includedLines = lines.filter((line) => line.includes(entry.match));
			for (const line of includedLines) {
				this.emit("gameEvent", { event: entry.event, data: line });
			}
		}

		for (const pattern of Patterns) {
			const matchedLines = lines.filter((line) => pattern.regex.test(line));
			for (const line of matchedLines) {
				const match = line.match(pattern.regex);
				if (match) {
					this.emit("gameEvent", { event: pattern.event, data: match[0] });
				}
			}
		}
	}

	/** Quits Roblox */
	public async quit() {
		if (this.gameInstance == null) throw new Error("The instance hasn't be started yet");

		console.log("Quitting Roblox");
		await os.execCommand(`kill -9 ${this.gameInstance}`);
	}
}
