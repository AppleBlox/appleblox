// frontend/src/windows/main/ts/utils/logger.ts

import { filesystem, os } from '@neutralinojs/lib';
import { version } from '@root/package.json';
import path from 'path-browserify';
import { getMode, getPosixCompatibleDate } from '.';

// Set to true to disable all logger logic and use plain console logs
const DISABLE_LOGGER = false;

type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' | 'TRACE';

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

// SECURITY: Patterns that should be redacted from logs
// This prevents accidental leakage of sensitive data
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
	// Roblox security cookie
	{ pattern: /\.ROBLOSECURITY[=:]\s*[^\s;,'"}\]]+/gi, replacement: '.ROBLOSECURITY=[REDACTED]' },
	{ pattern: /_\|WARNING:-DO-NOT-SHARE-THIS[^\s;,'"}\]]*/gi, replacement: '[REDACTED_COOKIE]' },
	// Generic cookie patterns
	{ pattern: /Cookie:\s*[^\n]+/gi, replacement: 'Cookie: [REDACTED]' },
	// Bearer tokens
	{ pattern: /Bearer\s+[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_=]*\.?[A-Za-z0-9\-_=]*/gi, replacement: 'Bearer [REDACTED]' },
];

/**
 * SECURITY: Redact sensitive information from a string
 * This should be called on all log output to prevent credential leakage
 */
function redactSensitiveData(input: string): string {
	let result = input;
	for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
		result = result.replace(pattern, replacement);
	}
	return result;
}

let logPath: string | null = null;
let isInitialized = false;
let isNeutralinoReady = false;
let pendingLogs: Array<{ timestamp: string; level: LogLevel; fileName: string; context: string; message: string }> = [];

class TypeUtils {
	static isError(value: any): value is Error {
		return (
			value instanceof Error ||
			(value && typeof value === 'object' && typeof value.message === 'string' && typeof value.name === 'string')
		);
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
		} catch {}

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
				} catch {}
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
				} catch {}
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
				// SECURITY: Always redact sensitive data from strings
				const safeValue = redactSensitiveData(value);
				return safeValue.length <= options.maxStringLength
					? safeValue
					: `${safeValue.substring(0, options.maxStringLength)}... [truncated]`;
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

	static formatLogLine(timestamp: string, level: LogLevel, fileName: string, context: string, message: string): string {
		const levelMap: Record<LogLevel, string> = {
			ERROR: 'Error',
			WARN: 'Warning',
			INFO: 'Info',
			DEBUG: 'Debug',
			TRACE: 'Trace',
		};

		const processName = 'app';
		const pid = Math.floor(Math.random() * 10000);
		const prefix = context ? `[${fileName}] [${context}]` : `[${fileName}]`;

		// SECURITY: Final redaction pass to catch any edge cases
		const safeMessage = redactSensitiveData(message);
		return `${timestamp} ${processName}[${pid}] <${levelMap[level]}> ${prefix} ${safeMessage}`;
	}
}

async function initializeLogPath(): Promise<void> {
	if (isInitialized) return;

	try {
		const configPath = path.join(await os.getPath('data'), 'AppleBlox', 'config');
		const logsDir = path.join(path.dirname(configPath), 'logs');
		try {
			if (!(await filesystem.getStats(logsDir))) {
				await filesystem.createDirectory(logsDir);
			}
		} catch (err) {}

		if (getMode() === 'dev') {
			logPath = path.join(logsDir, 'dev.log');
		} else {
			logPath = path.join(logsDir, `${getPosixCompatibleDate()}_${version}.log`);
		}
		try {
			if (!(await filesystem.getStats(logPath))) {
				await filesystem.writeFile(logPath, '');
			}
		} catch (err) {}

		isInitialized = true;
	} catch (error) {
		console.error('Failed to initialize log path:', error);
		isInitialized = true;
	}
}

async function writePendingLogs(): Promise<void> {
	if (!isNeutralinoReady || !logPath || pendingLogs.length === 0) return;

	const logsToWrite = [...pendingLogs];
	pendingLogs = [];

	for (const log of logsToWrite) {
		try {
			const logLine = LogFormatter.formatLogLine(log.timestamp, log.level, log.fileName, log.context, log.message) + '\n';
			await filesystem.appendFile(logPath, logLine);
		} catch (error) {
			console.error('Failed to write pending log to file:', error);
		}
	}
}

async function writeToFile(
	timestamp: string,
	level: LogLevel,
	fileName: string,
	context: string,
	message: string
): Promise<void> {
	if (!isNeutralinoReady) {
		pendingLogs.push({ timestamp, level, fileName, context, message });
		return;
	}

	if (!isInitialized) {
		await initializeLogPath();
	}

	if (!logPath) return;

	try {
		const logLine = LogFormatter.formatLogLine(timestamp, level, fileName, context, message) + '\n';
		await filesystem.appendFile(logPath, logLine);
	} catch {
		// Directory may have been deleted (e.g. after a reset) - try to recreate it once
		try {
			const logsDir = path.dirname(logPath);
			await filesystem.createDirectory(logsDir);
			const logLine = LogFormatter.formatLogLine(timestamp, level, fileName, context, message) + '\n';
			await filesystem.appendFile(logPath, logLine);
		} catch {
			// Silently give up - the data directory may be gone intentionally
		}
	}
}

class Logger {
	private static getCallerInfo(): string {
		const error = new Error();
		const stack = error.stack?.split('\n');

		if (!stack || stack.length < 4) return 'Unknown';

		const callerLine = stack[3];

		let match = callerLine.match(/at\s+(?:.*\s+)?\(?(.+?):(\d+):(\d+)\)?/);

		if (!match) {
			match = callerLine.match(/(?:@)?(.+?):(\d+):(\d+)/);
		}

		if (!match) return 'Unknown';

		const fullPath = match[1];

		const fileName =
			fullPath
				.split('/')
				.pop()
				?.split('?')[0]
				?.replace(/\.(ts|js|svelte)$/, '') || 'Unknown';

		return fileName;
	}

	private static log(level: LogLevel, args: any[], context?: string): void {
		// If logger is disabled, just use console
		if (DISABLE_LOGGER) {
			const consoleMethod = level.toLowerCase() as 'info' | 'error' | 'warn' | 'debug' | 'trace';
			console[consoleMethod](...args);
			return;
		}

		const fileName = this.getCallerInfo();
		const timestamp = LogFormatter.getTimestamp();
		const formattedArgs = args.map((arg) => LogFormatter.formatValue(arg)).join(' ');
		const prefix = context ? `[${fileName}] [${context}]` : `[${fileName}]`;

		// Console output (synchronous)
		const consoleMethod = level.toLowerCase() as 'info' | 'error' | 'warn' | 'debug' | 'trace';
		console[consoleMethod](prefix, ...args);

		// File output (non-blocking)
		setTimeout(() => {
			writeToFile(timestamp, level, fileName, context || '', formattedArgs);
		}, 0);
	}

	public static info(...args: any[]): void {
		this.log('INFO', args);
	}

	public static error(...args: any[]): void {
		this.log('ERROR', args);
	}

	public static warn(...args: any[]): void {
		this.log('WARN', args);
	}

	public static debug(...args: any[]): void {
		this.log('DEBUG', args);
	}

	public static trace(...args: any[]): void {
		this.log('TRACE', args);
	}

	public static withContext(context: string) {
		return {
			info: (...args: any[]) => this.log('INFO', args, context),
			error: (...args: any[]) => this.log('ERROR', args, context),
			warn: (...args: any[]) => this.log('WARN', args, context),
			debug: (...args: any[]) => this.log('DEBUG', args, context),
			trace: (...args: any[]) => this.log('TRACE', args, context),
		};
	}
}

export async function initializeLogger() {
	if (DISABLE_LOGGER) return;

	isNeutralinoReady = true;

	// Initialize log path and write any pending logs
	setTimeout(async () => {
		try {
			await initializeLogPath();
			await writePendingLogs();
		} catch (error) {
			console.error('Failed to initialize logger on appReady:', error);
		}
	}, 0);
}

export default Logger;
