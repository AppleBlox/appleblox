// File with debugging functions
// It will redirect the app's logs to the appleblox.log file while still logging in the web browser
import { filesystem } from "@neutralinojs/lib";
import path from "path-browserify";
import { dataPath, loadSettings } from "./settings";
import { pathExists } from "./utils";
import * as StackTrace from "stacktrace-js";

/** Tries to format every variable to a string */
function formatConsoleLog(...args: any[]): string {
	return (
		`[${new Date().toLocaleTimeString()}] ` +
		args
			.map((arg) => {
				if (arg === null) {
					return "null";
				} else if (arg === undefined) {
					return "undefined";
				} else if (typeof arg === "string") {
					return arg;
				} else if (typeof arg === "number") {
					return arg.toString();
				} else if (typeof arg === "boolean") {
					return arg.toString();
				} else if (Array.isArray(arg)) {
					return JSON.stringify(arg);
				} else if (typeof arg === "object") {
					return JSON.stringify(arg, getCircularReplacer());
				} else if (typeof arg === "function") {
					return arg.toString();
				} else {
					return String(arg);
				}
			})
			.join(" ")
	);
}

function getCircularReplacer() {
	const seen = new WeakSet();
	return (key: string, value: any) => {
		if (typeof value === "object" && value !== null) {
			if (seen.has(value)) {
				return "[Circular]";
			}
			seen.add(value);
		}
		return value;
	};
}

/** Clears the logs */
export async function clearLogs() {
	try {
		const appleBloxDir = path.dirname(await dataPath());
		await filesystem.writeFile(path.join(appleBloxDir, "appleblox.log"), "");
	} catch (err) {
		console.error("Failed to clear the logs:");
		console.error(err);
	}
}

/** Appends a message to the log file */
async function appendLog(message: string) {
	try {
		const appleBloxDir = path.dirname(await dataPath());
		await filesystem.appendFile(path.join(appleBloxDir, "appleblox.log"), message + "\n");
	} catch (err) {
		console.error("Failed to write log to file", err);
	}
}

function createLoggerFunction(originalFunction: Function, logLevel: string) {
	return async function (...args: any[]) {
		if (isRedirectionEnabled) {
			const formattedMessage = formatConsoleLog(...args);
			await appendLog(formattedMessage);
			// Use apply to maintain the correct context and pass all arguments
			originalFunction.apply(console, [...args]);
		} else {
			// If redirection is not enabled, just call the original function
			originalFunction.apply(console, args);
		}
	};
}

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

let isRedirectionEnabled = false;
let overriddenConsoleFunctions = false;

(async () => {
	const settings = await loadSettings("misc");
	if (!settings) return;
	isRedirectionEnabled = settings.advanced.redirect_console;
	if (isRedirectionEnabled) {
		overrideConsoleFunctions();
	}
})();

function overrideConsoleFunctions() {
	if (!overriddenConsoleFunctions) {
		console.log = createLoggerFunction(originalConsoleLog, "INFO");
		console.error = createLoggerFunction(originalConsoleError, "ERROR");
		console.warn = createLoggerFunction(originalConsoleWarn, "WARN");
		console.info = createLoggerFunction(originalConsoleInfo, "INFO");
		console.debug = createLoggerFunction(originalConsoleDebug, "DEBUG");
		overriddenConsoleFunctions = true;
	}
}

function restoreConsoleFunctions() {
	if (overriddenConsoleFunctions) {
		console.log = originalConsoleLog;
		console.error = originalConsoleError;
		console.warn = originalConsoleWarn;
		console.info = originalConsoleInfo;
		console.debug = originalConsoleDebug;
		overriddenConsoleFunctions = false;
	}
}

export async function enableConsoleRedirection() {
	const appleBloxDir = path.dirname(await dataPath());
	if (!pathExists(appleBloxDir)) {
		await filesystem.createDirectory(appleBloxDir);
	}
	isRedirectionEnabled = true;
	overrideConsoleFunctions();
	console.log("Enabled console redirection");
}

export function disableConsoleRedirection() {
	isRedirectionEnabled = false;
	restoreConsoleFunctions();
	console.log("Disabled console redirection");
}
