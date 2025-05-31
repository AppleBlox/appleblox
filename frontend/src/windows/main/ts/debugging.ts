import { filesystem } from '@neutralinojs/lib';
import { version } from '@root/package.json';
import path from 'path-browserify';
import { getConfigPath, loadSettings } from '../components/settings';
import shellFS from './tools/shellfs';
import { getMode, getPosixCompatibleDate } from './utils';

// Types
type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' | 'TRACE';
type ConsoleMethod = keyof typeof console;

interface LoggerState {
	isRedirectionEnabled: boolean;
	overriddenConsoleFunctions: boolean;
	logPath: string | null;
}

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
}

// Logger state management
const state: LoggerState = {
	isRedirectionEnabled: false,
	overriddenConsoleFunctions: false,
	logPath: null,
};

// Original console methods store
const originalConsoleMethods: Partial<Record<ConsoleMethod, Function>> = {
	log: console.log,
	error: console.error,
	warn: console.warn,
	info: console.info,
	debug: console.debug,
	trace: console.trace,
};

// Formatting utilities
class LogFormatter {
	static getTimestamp(): string {
		return new Date().toISOString();
	}

	static formatError(error: Error): string {
		return `${error.name}: ${error.message}\nStack: ${error.stack || 'No stack trace available'}`;
	}

	static formatObject(obj: object): string {
		try {
			return JSON.stringify(obj, this.circularReplacer(), 2);
		} catch (err) {
			return `[Object: circular or complex structure]\n${String(obj)}`;
		}
	}

	static formatArray(arr: any[]): string {
		try {
			return JSON.stringify(arr, this.circularReplacer(), 2);
		} catch (err) {
			return `[Array: circular or complex structure]\n${String(arr)}`;
		}
	}

	static formatValue(value: any): string {
		if (value === null) return 'null';
		if (value === undefined) return 'undefined';

		switch (typeof value) {
			case 'string':
				return value;
			case 'number':
				return value.toString();
			case 'boolean':
				return value.toString();
			case 'function':
				return `[Function: ${value.name || 'anonymous'}]`;
			case 'symbol':
				return value.toString();
			case 'bigint':
				return `${value.toString()}n`;
			case 'object':
				if (value instanceof Error) return this.formatError(value);
				if (Array.isArray(value)) return this.formatArray(value);
				if (value instanceof Map) return this.formatObject(Object.fromEntries(value));
				if (value instanceof Set) return this.formatArray(Array.from(value));
				if (value instanceof Date) return value.toISOString();
				if (value instanceof RegExp) return value.toString();
				return this.formatObject(value);
			default:
				return String(value);
		}
	}

	private static circularReplacer() {
		const seen = new WeakSet();
		return (key: string, value: any) => {
			if (typeof value === 'object' && value !== null) {
				if (seen.has(value)) {
					return '[Circular]';
				}
				seen.add(value);
			}
			return value;
		};
	}

	static formatLogEntry(level: LogLevel, args: any[]): LogEntry {
		const formattedArgs = args.map((arg) => this.formatValue(arg)).join(' ');
		return {
			timestamp: this.getTimestamp(),
			level,
			message: formattedArgs,
		};
	}
}

// File management
class LogFileManager {
	static async setupLogDirectory(): Promise<string> {
		const logsDir = path.join(path.dirname(await getConfigPath()), 'logs');
		if (!(await shellFS.exists(logsDir))) {
			await shellFS.createDirectory(logsDir);
		}
		return logsDir;
	}

	static async createLogPath(): Promise<string> {
		const logsDir = await this.setupLogDirectory();
		if (getMode() === 'dev') {
			return path.join(logsDir, 'dev.log');
		}
		return path.join(logsDir, `${getPosixCompatibleDate()}_${version}.log`);
	}

	static async ensureLogFile(logPath: string): Promise<void> {
		if (!(await shellFS.exists(logPath))) {
			await shellFS.writeFile(logPath, '');
		}
	}

	static async appendToLog(logPath: string, entry: LogEntry): Promise<void> {
		const logLine = `[${entry.timestamp}] [${entry.level}] ${entry.message}\n`;
		try {
			await filesystem.appendFile(logPath, logLine);
		} catch (err) {
			// Use original console to avoid infinite recursion
			originalConsoleMethods.error?.call(console, 'Failed to write to log file:', err);
		}
	}
}

// Console override management
class ConsoleManager {
	static createLoggerFunction(originalFn: Function, level: LogLevel) {
		return async (...args: any[]) => {
			if (!state.isRedirectionEnabled) {
				return originalFn.apply(console, args);
			}

			const logEntry = LogFormatter.formatLogEntry(level, args);

			// Ensure we have a log path
			if (!state.logPath) {
				state.logPath = await LogFileManager.createLogPath();
				await LogFileManager.ensureLogFile(state.logPath);
			}

			// Write to file
			await LogFileManager.appendToLog(state.logPath, logEntry);

			// Write to original console
			originalFn.apply(console, args);
		};
	}

	static override(): void {
		if (state.overriddenConsoleFunctions) return;

		console.log = this.createLoggerFunction(originalConsoleMethods.log!, 'INFO');
		console.error = this.createLoggerFunction(originalConsoleMethods.error!, 'ERROR');
		console.warn = this.createLoggerFunction(originalConsoleMethods.warn!, 'WARN');
		console.info = this.createLoggerFunction(originalConsoleMethods.info!, 'INFO');
		console.debug = this.createLoggerFunction(originalConsoleMethods.debug!, 'DEBUG');
		console.trace = this.createLoggerFunction(originalConsoleMethods.trace!, 'TRACE');

		state.overriddenConsoleFunctions = true;
	}

	static restore(): void {
		if (!state.overriddenConsoleFunctions) return;

		Object.entries(originalConsoleMethods).forEach(([method, fn]) => {
			if (fn) {
				(console as any)[method] = fn;
			}
		});

		state.overriddenConsoleFunctions = false;
	}
}

// Initialize logger
(async () => {
	const settings = await loadSettings('misc');
	if (!settings) return;

	state.isRedirectionEnabled = settings.advanced.redirect_console;
	if (state.isRedirectionEnabled) {
		state.logPath = await LogFileManager.createLogPath();
		await LogFileManager.ensureLogFile(state.logPath);
		ConsoleManager.override();
	}
})();

// Public API
export function formatConsoleLog(...args: any[]): string {
	const { message } = LogFormatter.formatLogEntry('INFO', args);
	return message;
}
export async function enableConsoleRedirection(): Promise<void> {
	const appleBloxDir = path.dirname(await getConfigPath());
	if (!shellFS.exists(appleBloxDir)) {
		await filesystem.createDirectory(appleBloxDir);
	}

	state.isRedirectionEnabled = true;
	state.logPath = await LogFileManager.createLogPath();
	await LogFileManager.ensureLogFile(state.logPath);
	ConsoleManager.override();

	console.info('[Debugging] Enabled console redirection');
}

export function disableConsoleRedirection(): void {
	state.isRedirectionEnabled = false;
	ConsoleManager.restore();
	console.info('[Debugging] Disabled console redirection');
}
