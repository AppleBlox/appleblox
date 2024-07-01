// This serves the purpose of redirecting every console logs to the neutralinojs.log file for debugging on the users' end.

import { debug } from "@neutralinojs/lib";

let isRedirectionEnabled = false;

function formatConsoleLog(...args: any[]): string {
	return args
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
		.join(" ");
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

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

console.log = (...args: any[]) => {
	if (isRedirectionEnabled) {
		const formattedMessage = formatConsoleLog(...args);
		debug.log(formattedMessage);
	}
	originalConsoleLog.apply(console, args);
};

console.error = (...args: any[]) => {
	if (isRedirectionEnabled) {
		const formattedMessage = formatConsoleLog(...args);
		debug.log(formattedMessage);
	}
	originalConsoleError.apply(console, args);
};

console.warn = (...args: any[]) => {
	if (isRedirectionEnabled) {
		const formattedMessage = formatConsoleLog(...args);
		debug.log(formattedMessage);
	}
	originalConsoleWarn.apply(console, args);
};

console.info = (...args: any[]) => {
	if (isRedirectionEnabled) {
		const formattedMessage = formatConsoleLog(...args);
		debug.log(formattedMessage);
	}
	originalConsoleInfo.apply(console, args);
};

console.debug = (...args: any[]) => {
	if (isRedirectionEnabled) {
		const formattedMessage = formatConsoleLog(...args);
		debug.log(formattedMessage);
	}
	originalConsoleDebug.apply(console, args);
};

export function enableConsoleRedirection() {
	isRedirectionEnabled = true;
}

export function disableConsoleRedirection() {
	isRedirectionEnabled = false;
}
