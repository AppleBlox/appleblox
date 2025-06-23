import { filesystem } from '@neutralinojs/lib';
import { version } from '@root/package.json';
import path from 'path-browserify';
import { getConfigPath, loadSettings } from '../components/settings';
import shellFS from './tools/shellfs';
import { getMode, getPosixCompatibleDate } from './utils';

type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' | 'TRACE';
type ConsoleMethod = keyof typeof console;

interface LoggerState {
	isRedirectionEnabled: boolean;
	overriddenConsoleFunctions: boolean;
	logPath: string | null;
	initializationError: Error | null;
}

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
}

interface SerializationOptions {
	maxDepth: number;
	maxArrayLength: number;
	maxStringLength: number;
	includeNonEnumerable: boolean;
}

const DEFAULT_SERIALIZATION_OPTIONS: SerializationOptions = {
	maxDepth: 5,
	maxArrayLength: 100,
	maxStringLength: 10000,
	includeNonEnumerable: false,
};

const SAFE_OBJECT_METHODS = ['toString', 'valueOf', 'toJSON'];

const state: LoggerState = {
	isRedirectionEnabled: false,
	overriddenConsoleFunctions: false,
	logPath: null,
	initializationError: null,
};

const originalConsoleMethods: Partial<Record<ConsoleMethod, Function>> = {
	log: console.log,
	error: console.error,
	warn: console.warn,
	info: console.info,
	debug: console.debug,
	trace: console.trace,
};

class TypeUtils {
	static isError(value: any): value is Error {
		return value instanceof Error || 
			   (value && typeof value === 'object' && 
			    typeof value.message === 'string' && 
			    typeof value.name === 'string');
	}

	static isPlainObject(value: any): boolean {
		if (value === null || typeof value !== 'object') return false;
		
		const proto = Object.getPrototypeOf(value);
		return proto === null || proto === Object.prototype;
	}

	static isSerializable(value: any): boolean {
		try {
			JSON.stringify(value);
			return true;
		} catch {
			return false;
		}
	}

	static safeGetProperty(obj: any, prop: string): any {
		try {
			return obj[prop];
		} catch (error) {
			return `[Error accessing property: ${error instanceof Error ? error.message : 'Unknown error'}]`;
		}
	}

	static getObjectInfo(obj: any): string {
		try {
			const constructor = obj.constructor;
			const name = constructor?.name || 'Object';
			const proto = Object.getPrototypeOf(obj);
			const protoName = proto?.constructor?.name || 'Unknown';
			
			return `[${name}${name !== protoName ? ` extends ${protoName}` : ''}]`;
		} catch {
			return '[Object]';
		}
	}
}

class LogFormatter {
	static getTimestamp(): string {
		try {
			const now = new Date();
			const year = now.getFullYear();
			const month = String(now.getMonth() + 1).padStart(2, '0');
			const day = String(now.getDate()).padStart(2, '0');
			const hours = String(now.getHours()).padStart(2, '0');
			const minutes = String(now.getMinutes()).padStart(2, '0');
			const seconds = String(now.getSeconds()).padStart(2, '0');
			const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
			
			return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
		} catch {
			return new Date().toString();
		}
	}

	static formatError(error: any, options: SerializationOptions = DEFAULT_SERIALIZATION_OPTIONS): string {
		if (!TypeUtils.isError(error)) {
			return this.formatValue(error, options);
		}

		try {
			const parts: string[] = [];
			
			const name = TypeUtils.safeGetProperty(error, 'name') || 'Error';
			const message = TypeUtils.safeGetProperty(error, 'message') || 'No message';
			parts.push(`${name}: ${message}`);

			const stack = TypeUtils.safeGetProperty(error, 'stack');
			if (stack && typeof stack === 'string') {
				parts.push(`Stack: ${stack}`);
			}

			const additionalProps = this.getErrorProperties(error);
			if (additionalProps.length > 0) {
				parts.push(`Additional properties: ${additionalProps.join(', ')}`);
			}

			const cause = TypeUtils.safeGetProperty(error, 'cause');
			if (cause) {
				parts.push(`Caused by: ${this.formatError(cause, options)}`);
			}

			return parts.join('\n');
		} catch (formatError) {
			return `[Error formatting error: ${formatError instanceof Error ? formatError.message : 'Unknown'}]\nOriginal: ${String(error)}`;
		}
	}

	private static getErrorProperties(error: any): string[] {
		const standardProps = new Set(['name', 'message', 'stack', 'cause']);
		const props: string[] = [];

		try {
			for (const key in error) {
				if (!standardProps.has(key)) {
					try {
						const value = error[key];
						props.push(`${key}: ${this.formatValue(value, { ...DEFAULT_SERIALIZATION_OPTIONS, maxDepth: 2 })}`);
					} catch {
						props.push(`${key}: [Error accessing property]`);
					}
				}
			}

			if (DEFAULT_SERIALIZATION_OPTIONS.includeNonEnumerable) {
				const ownProps = Object.getOwnPropertyNames(error);
				for (const key of ownProps) {
					if (!standardProps.has(key) && !error.propertyIsEnumerable(key)) {
						try {
							const value = error[key];
							props.push(`${key}: ${this.formatValue(value, { ...DEFAULT_SERIALIZATION_OPTIONS, maxDepth: 1 })}`);
						} catch {
							props.push(`${key}: [Error accessing property]`);
						}
					}
				}
			}
		} catch {
		}

		return props;
	}

	static formatObject(obj: any, options: SerializationOptions = DEFAULT_SERIALIZATION_OPTIONS, depth: number = 0): string {
		if (depth >= options.maxDepth) {
			return `[Object: max depth reached] ${TypeUtils.getObjectInfo(obj)}`;
		}

		if (obj === null) return 'null';
		if (obj === undefined) return 'undefined';

		try {
			if (typeof obj.toJSON === 'function') {
				try {
					const jsonResult = obj.toJSON();
					if (jsonResult !== obj) {
						return this.formatValue(jsonResult, options, depth + 1);
					}
				} catch {
				}
			}

			if (TypeUtils.isPlainObject(obj) && TypeUtils.isSerializable(obj)) {
				return JSON.stringify(obj, this.createCircularReplacer(options), 2);
			}

			return this.formatComplexObject(obj, options, depth);
		} catch (err) {
			return `[Object serialization error: ${err instanceof Error ? err.message : 'Unknown'}] ${TypeUtils.getObjectInfo(obj)}`;
		}
	}

	private static formatComplexObject(obj: any, options: SerializationOptions, depth: number): string {
		const info = TypeUtils.getObjectInfo(obj);
		
		try {
			if (obj.toString !== Object.prototype.toString && typeof obj.toString === 'function') {
				try {
					const stringResult = obj.toString();
					if (stringResult !== '[object Object]' && stringResult.length <= options.maxStringLength) {
						return `${info} ${stringResult}`;
					}
				} catch {
				}
			}

			const props: string[] = [];
			const maxProps = 10;
			let propCount = 0;

			for (const key in obj) {
				if (propCount >= maxProps) {
					props.push('...');
					break;
				}

				try {
					const value = obj[key];
					const formattedValue = this.formatValue(value, options, depth + 1);
					props.push(`${key}: ${formattedValue}`);
					propCount++;
				} catch {
					props.push(`${key}: [Error accessing property]`);
					propCount++;
				}
			}

			return `${info} { ${props.join(', ')} }`;
		} catch {
			return `${info} [Unable to serialize properties]`;
		}
	}

	static formatArray(arr: any[], options: SerializationOptions = DEFAULT_SERIALIZATION_OPTIONS, depth: number = 0): string {
		if (depth >= options.maxDepth) {
			return `[Array(${arr.length}): max depth reached]`;
		}

		try {
			const maxLength = Math.min(arr.length, options.maxArrayLength);
			const items: string[] = [];

			for (let i = 0; i < maxLength; i++) {
				try {
					items.push(this.formatValue(arr[i], options, depth + 1));
				} catch {
					items.push('[Error accessing array element]');
				}
			}

			if (arr.length > maxLength) {
				items.push(`... ${arr.length - maxLength} more items`);
			}

			return `[${items.join(', ')}]`;
		} catch (err) {
			return `[Array(${arr.length}): serialization error - ${err instanceof Error ? err.message : 'Unknown'}]`;
		}
	}

	static formatValue(value: any, options: SerializationOptions = DEFAULT_SERIALIZATION_OPTIONS, depth: number = 0): string {
		if (depth >= options.maxDepth) {
			return '[Max depth reached]';
		}

		if (value === null) return 'null';
		if (value === undefined) return 'undefined';

		switch (typeof value) {
			case 'string':
				return value.length <= options.maxStringLength 
					? value 
					: `${value.substring(0, options.maxStringLength)}... [truncated]`;
			case 'number':
				return isNaN(value) ? 'NaN' : value.toString();
			case 'boolean':
				return value.toString();
			case 'function':
				return `[Function: ${value.name || 'anonymous'}]`;
			case 'symbol':
				try {
					return value.toString();
				} catch {
					return '[Symbol: unable to convert]';
				}
			case 'bigint':
				return `${value.toString()}n`;
			case 'object':
				if (TypeUtils.isError(value)) return this.formatError(value, options);
				if (Array.isArray(value)) return this.formatArray(value, options, depth);
				if (value instanceof Map) {
					try {
						return this.formatObject(Object.fromEntries(value), options, depth);
					} catch {
						return `[Map(${value.size}): unable to serialize]`;
					}
				}
				if (value instanceof Set) {
					try {
						return this.formatArray(Array.from(value), options, depth);
					} catch {
						return `[Set(${value.size}): unable to serialize]`;
					}
				}
				if (value instanceof Date) {
					try {
						return value.toISOString();
					} catch {
						return '[Date: invalid]';
					}
				}
				if (value instanceof RegExp) {
					return value.toString();
				}
				if (value instanceof Promise) {
					return '[Promise]';
				}
				return this.formatObject(value, options, depth);
			default:
				return String(value);
		}
	}

	private static createCircularReplacer(options: SerializationOptions) {
		const seen = new WeakSet();
		let depth = 0;

		return (key: string, value: any) => {
			if (depth >= options.maxDepth) {
				return '[Max depth reached]';
			}

			if (typeof value === 'object' && value !== null) {
				if (seen.has(value)) {
					return '[Circular]';
				}
				seen.add(value);
			}

			depth++;
			const result = value;
			depth--;

			return result;
		};
	}

	static formatLogEntry(level: LogLevel, args: any[]): LogEntry {
		try {
			const formattedArgs = args.map((arg) => this.formatValue(arg)).join(' ');
			return {
				timestamp: this.getTimestamp(),
				level,
				message: formattedArgs,
			};
		} catch (error) {
			return {
				timestamp: this.getTimestamp(),
				level: 'ERROR',
				message: `[Error formatting log entry: ${error instanceof Error ? error.message : 'Unknown'}] Original args: ${args.length} items`,
			};
		}
	}

	static formatLogLine(entry: LogEntry): string {
		const levelMap: Record<LogLevel, string> = {
			'ERROR': 'Error',
			'WARN': 'Warning', 
			'INFO': 'Info',
			'DEBUG': 'Debug',
			'TRACE': 'Trace'
		};

		const processName = 'app';
		const pid = Math.floor(Math.random() * 10000);
		
		return `${entry.timestamp} ${processName}[${pid}] <${levelMap[entry.level]}> ${entry.message}`;
	}
}

class LogFileManager {
	private static async safeOperation<T>(operation: () => Promise<T>, errorMessage: string): Promise<T | null> {
		try {
			return await operation();
		} catch (error) {
			originalConsoleMethods.error?.call(console, `${errorMessage}:`, error);
			return null;
		}
	}

	static async setupLogDirectory(): Promise<string | null> {
		return this.safeOperation(async () => {
			const configPath = await getConfigPath();
			const logsDir = path.join(path.dirname(configPath), 'logs');
			
			if (!(await shellFS.exists(logsDir))) {
				await shellFS.createDirectory(logsDir);
			}
			
			return logsDir;
		}, 'Failed to setup log directory');
	}

	static async createLogPath(): Promise<string | null> {
		const logsDir = await this.setupLogDirectory();
		if (!logsDir) return null;

		try {
			if (getMode() === 'dev') {
				return path.join(logsDir, 'dev.log');
			}
			return path.join(logsDir, `${getPosixCompatibleDate()}_${version}.log`);
		} catch (error) {
			originalConsoleMethods.error?.call(console, 'Failed to create log path:', error);
			return null;
		}
	}

	static async ensureLogFile(logPath: string): Promise<boolean> {
		return (await this.safeOperation(async () => {
			if (!(await shellFS.exists(logPath))) {
				await shellFS.writeFile(logPath, '');
			}
			return true;
		}, `Failed to ensure log file exists: ${logPath}`)) !== null;
	}

	static async appendToLog(logPath: string, entry: LogEntry): Promise<boolean> {
		return (await this.safeOperation(async () => {
			const logLine = LogFormatter.formatLogLine(entry) + '\n';
			await filesystem.appendFile(logPath, logLine);
			return true;
		}, `Failed to write to log file: ${logPath}`)) !== null;
	}
}

class ConsoleManager {
	static createLoggerFunction(originalFn: Function, level: LogLevel) {
		return async (...args: any[]) => {
			try {
				originalFn.apply(console, args);
			} catch (error) {
				try {
					originalConsoleMethods.error?.call(console, 'Console function failed:', error);
				} catch {
				}
			}

			if (!state.isRedirectionEnabled || state.initializationError) {
				return;
			}

			try {
				const logEntry = LogFormatter.formatLogEntry(level, args);

				if (!state.logPath) {
					state.logPath = await LogFileManager.createLogPath();
					if (!state.logPath) {
						state.initializationError = new Error('Failed to create log path');
						return;
					}

					const success = await LogFileManager.ensureLogFile(state.logPath);
					if (!success) {
						state.initializationError = new Error('Failed to ensure log file');
						return;
					}
				}

				await LogFileManager.appendToLog(state.logPath, logEntry);
			} catch (error) {
				try {
					originalConsoleMethods.error?.call(console, 'Logger error:', error);
				} catch {
				}
			}
		};
	}

	static override(): void {
		if (state.overriddenConsoleFunctions) return;

		try {
			console.log = this.createLoggerFunction(originalConsoleMethods.log!, 'INFO');
			console.error = this.createLoggerFunction(originalConsoleMethods.error!, 'ERROR');
			console.warn = this.createLoggerFunction(originalConsoleMethods.warn!, 'WARN');
			console.info = this.createLoggerFunction(originalConsoleMethods.info!, 'INFO');
			console.debug = this.createLoggerFunction(originalConsoleMethods.debug!, 'DEBUG');
			console.trace = this.createLoggerFunction(originalConsoleMethods.trace!, 'TRACE');

			state.overriddenConsoleFunctions = true;
		} catch (error) {
			originalConsoleMethods.error?.call(console, 'Failed to override console functions:', error);
		}
	}

	static restore(): void {
		if (!state.overriddenConsoleFunctions) return;

		try {
			Object.entries(originalConsoleMethods).forEach(([method, fn]) => {
				if (fn) {
					(console as any)[method] = fn;
				}
			});

			state.overriddenConsoleFunctions = false;
		} catch (error) {
			originalConsoleMethods.error?.call(console, 'Failed to restore console functions:', error);
		}
	}
}

(async () => {
	try {
		const settings = await loadSettings('misc');
		if (!settings) return;

		state.isRedirectionEnabled = settings.advanced.redirect_console;
		if (state.isRedirectionEnabled) {
			state.logPath = await LogFileManager.createLogPath();
			if (state.logPath) {
				const success = await LogFileManager.ensureLogFile(state.logPath);
				if (success) {
					ConsoleManager.override();
				} else {
					state.initializationError = new Error('Failed to ensure log file');
				}
			} else {
				state.initializationError = new Error('Failed to create log path');
			}
		}
	} catch (error) {
		state.initializationError = error instanceof Error ? error : new Error('Unknown initialization error');
		originalConsoleMethods.error?.call(console, 'Logger initialization failed:', error);
	}
})();

export function formatConsoleLog(...args: any[]): string {
	try {
		const { message } = LogFormatter.formatLogEntry('INFO', args);
		return message;
	} catch (error) {
		return `[Error formatting console log: ${error instanceof Error ? error.message : 'Unknown'}]`;
	}
}

export async function enableConsoleRedirection(): Promise<boolean> {
	try {
		const configPath = await getConfigPath();
		const appleBloxDir = path.dirname(configPath);
		
		if (!await shellFS.exists(appleBloxDir)) {
			await filesystem.createDirectory(appleBloxDir);
		}

		state.isRedirectionEnabled = true;
		state.initializationError = null;
		
		state.logPath = await LogFileManager.createLogPath();
		if (!state.logPath) {
			state.initializationError = new Error('Failed to create log path');
			return false;
		}

		const success = await LogFileManager.ensureLogFile(state.logPath);
		if (!success) {
			state.initializationError = new Error('Failed to ensure log file');
			return false;
		}

		ConsoleManager.override();
		console.info('[Debugging] Enabled console redirection');
		return true;
	} catch (error) {
		state.initializationError = error instanceof Error ? error : new Error('Unknown error');
		originalConsoleMethods.error?.call(console, 'Failed to enable console redirection:', error);
		return false;
	}
}

export function disableConsoleRedirection(): void {
	try {
		state.isRedirectionEnabled = false;
		state.initializationError = null;
		ConsoleManager.restore();
		console.info('[Debugging] Disabled console redirection');
	} catch (error) {
		originalConsoleMethods.error?.call(console, 'Failed to disable console redirection:', error);
	}
}

export function getLoggerStatus(): { enabled: boolean; error: string | null; logPath: string | null } {
	return {
		enabled: state.isRedirectionEnabled,
		error: state.initializationError?.message || null,
		logPath: state.logPath,
	};
}