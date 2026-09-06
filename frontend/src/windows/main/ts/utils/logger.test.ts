import { describe, expect, it, beforeEach, beforeAll, mock } from 'bun:test';

mock.module('@neutralinojs/lib', () => ({
	filesystem: {
		getStats: mock(() => Promise.resolve(null)),
		createDirectory: mock(() => Promise.resolve()),
		writeFile: mock(() => Promise.resolve()),
		appendFile: mock(() => Promise.resolve()),
	},
	os: {
		getPath: mock(() => Promise.resolve('/tmp/test')),
	},
}));

mock.module('@root/package.json', () => ({
	version: '0.0.0-test',
}));

type LoggerModule = typeof import('./logger');

let Logger: LoggerModule['default'];
let getLogBuffer: LoggerModule['getLogBuffer'];
let getRecentErrors: LoggerModule['getRecentErrors'];

// Use a cache-busting query param to bypass any mock.module from other test files
// (e.g. fflags.test.ts) that mocks '@/windows/main/ts/utils/logger'.
beforeAll(async () => {
	const mod: LoggerModule = await import(`./logger?test=${Date.now()}`);
	Logger = mod.default;
	getLogBuffer = mod.getLogBuffer;
	getRecentErrors = mod.getRecentErrors;
});

describe('Logger', () => {
	beforeEach(() => {
		global.console = {
			...console,
			log: mock(() => {}),
			warn: mock(() => {}),
			error: mock(() => {}),
			info: mock(() => {}),
			debug: mock(() => {}),
			trace: mock(() => {}),
		};
	});

	describe('Basic Logging', () => {
		it('should import without errors', () => {
			expect(Logger).toBeDefined();
			expect(Logger.info).toBeDefined();
			expect(Logger.warn).toBeDefined();
			expect(Logger.error).toBeDefined();
			expect(Logger.debug).toBeDefined();
			expect(Logger.trace).toBeDefined();
		});

		it('should support withContext for creating contextual loggers', () => {
			const contextLogger = Logger.withContext('TestContext');
			expect(contextLogger).toBeDefined();
			expect(contextLogger.info).toBeDefined();
			expect(contextLogger.warn).toBeDefined();
			expect(contextLogger.error).toBeDefined();
			expect(contextLogger.debug).toBeDefined();
			expect(contextLogger.trace).toBeDefined();
		});

		it('should call console.info when Logger.info is called', () => {
			Logger.info('test message');
			expect(console.info).toHaveBeenCalled();
		});

		it('should call console.error when Logger.error is called', () => {
			Logger.error('error message');
			expect(console.error).toHaveBeenCalled();
		});

		it('should call console.warn when Logger.warn is called', () => {
			Logger.warn('warn message');
			expect(console.warn).toHaveBeenCalled();
		});
	});

	describe('Log Buffer', () => {
		it('should add entries to the log buffer', () => {
			const bufferBefore = getLogBuffer().length;
			Logger.info('buffer test');
			const bufferAfter = getLogBuffer().length;
			expect(bufferAfter).toBe(bufferBefore + 1);
		});

		it('should store entries with correct level for info', () => {
			Logger.info('info level test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.level).toBe('INFO');
		});

		it('should store entries with correct level for error', () => {
			Logger.error('error level test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.level).toBe('ERROR');
		});

		it('should store entries with correct level for warn', () => {
			Logger.warn('warn level test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.level).toBe('WARN');
		});

		it('should include the message in the entry', () => {
			Logger.info('unique message 12345');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('unique message 12345');
		});

		it('should include a formatted string in the entry', () => {
			Logger.info('formatted test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.formatted).toBeDefined();
			expect(last.formatted.length).toBeGreaterThan(0);
		});

		it('should include a timestamp in the entry', () => {
			Logger.info('timestamp test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
		});

		it('should include fileName in the entry', () => {
			Logger.info('filename test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.fileName).toBeDefined();
			expect(typeof last.fileName).toBe('string');
		});

		it('should set context to empty string when no context is provided', () => {
			Logger.info('no context test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.context).toBe('');
		});

		it('should concatenate multiple arguments into the message', () => {
			Logger.info('hello', 'world', 42);
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('hello');
			expect(last.message).toContain('world');
			expect(last.message).toContain('42');
		});
	});

	describe('LogEntry structure', () => {
		it('should have all required fields', () => {
			Logger.info('structure test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			const keys = Object.keys(last);
			expect(keys).toContain('timestamp');
			expect(keys).toContain('level');
			expect(keys).toContain('fileName');
			expect(keys).toContain('context');
			expect(keys).toContain('message');
			expect(keys).toContain('formatted');
		});

		it('should include the level label in the formatted string', () => {
			Logger.info('label test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.formatted).toContain('<Info>');
		});

		it('should include Error label for error level', () => {
			Logger.error('error label test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.formatted).toContain('<Error>');
		});

		it('should include Warning label for warn level', () => {
			Logger.warn('warn label test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.formatted).toContain('<Warning>');
		});
	});

	describe('withContext', () => {
		it('should include context in the log entry', () => {
			const ctx = Logger.withContext('MyComponent');
			ctx.info('context info');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.context).toBe('MyComponent');
		});

		it('should include context in the formatted string', () => {
			const ctx = Logger.withContext('SomeContext');
			ctx.info('formatted context test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.formatted).toContain('[SomeContext]');
		});

		it('should log errors with context', () => {
			const ctx = Logger.withContext('ErrorCtx');
			ctx.error('context error test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.level).toBe('ERROR');
			expect(last.context).toBe('ErrorCtx');
		});

		it('should log warnings with context', () => {
			const ctx = Logger.withContext('WarnCtx');
			ctx.warn('context warn test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.level).toBe('WARN');
			expect(last.context).toBe('WarnCtx');
		});
	});

	describe('getRecentErrors', () => {
		it('should return only error entries', () => {
			Logger.info('not an error');
			Logger.warn('not an error either');
			Logger.error('this is an error');
			Logger.info('another non-error');

			const errors = getRecentErrors();
			for (const entry of errors) {
				expect(entry.level).toBe('ERROR');
			}
		});

		it('should include newly logged errors', () => {
			const marker = `error-marker-${Date.now()}`;
			Logger.error(marker);
			const errors = getRecentErrors();
			const found = errors.some((e) => e.message.includes(marker));
			expect(found).toBe(true);
		});

		it('should not include info or warn entries', () => {
			const infoMarker = `info-only-${Date.now()}`;
			const warnMarker = `warn-only-${Date.now()}`;
			Logger.info(infoMarker);
			Logger.warn(warnMarker);

			const errors = getRecentErrors();
			const foundInfo = errors.some((e) => e.message.includes(infoMarker));
			const foundWarn = errors.some((e) => e.message.includes(warnMarker));
			expect(foundInfo).toBe(false);
			expect(foundWarn).toBe(false);
		});

		it('should respect the count parameter', () => {
			for (let i = 0; i < 20; i++) {
				Logger.error(`bulk error ${i}`);
			}
			const limited = getRecentErrors(5);
			expect(limited.length).toBeLessThanOrEqual(5);
		});

		it('should return the most recent errors when limited', () => {
			const marker = `recent-error-${Date.now()}`;
			for (let i = 0; i < 15; i++) {
				Logger.error(`filler error ${i}`);
			}
			Logger.error(marker);

			const errors = getRecentErrors(3);
			const last = errors[errors.length - 1];
			expect(last.message).toContain(marker);
		});

		it('should default to 10 entries', () => {
			for (let i = 0; i < 20; i++) {
				Logger.error(`default-count-error ${i}`);
			}
			const errors = getRecentErrors();
			expect(errors.length).toBeLessThanOrEqual(10);
		});
	});

	describe('Redaction via log buffer', () => {
		it('should redact .ROBLOSECURITY cookie values', () => {
			Logger.info('token: .ROBLOSECURITY=abc123secretvalue');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('.ROBLOSECURITY=[REDACTED]');
			expect(last.message).not.toContain('abc123secretvalue');
			expect(last.formatted).toContain('.ROBLOSECURITY=[REDACTED]');
			expect(last.formatted).not.toContain('abc123secretvalue');
		});

		it('should redact .ROBLOSECURITY with colon separator', () => {
			Logger.info('cookie .ROBLOSECURITY: mysecretcookievalue123');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('.ROBLOSECURITY=[REDACTED]');
			expect(last.message).not.toContain('mysecretcookievalue123');
		});

		it('should redact the WARNING-DO-NOT-SHARE cookie pattern', () => {
			Logger.info('got cookie _|WARNING:-DO-NOT-SHARE-THIS--Roblox-Cookie-Data-abc123xyz');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('[REDACTED_COOKIE]');
			expect(last.message).not.toContain('abc123xyz');
			expect(last.formatted).toContain('[REDACTED_COOKIE]');
		});

		it('should redact Cookie header values', () => {
			Logger.info('request header Cookie: session=abc123; token=xyz789');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('Cookie: [REDACTED]');
			expect(last.message).not.toContain('session=abc123');
			expect(last.message).not.toContain('token=xyz789');
		});

		it('should redact Bearer tokens', () => {
			Logger.info(
				'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
			);
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('Bearer [REDACTED]');
			expect(last.message).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
			expect(last.formatted).toContain('Bearer [REDACTED]');
		});

		it('should not alter messages without sensitive data', () => {
			Logger.info('this is a normal log message with no secrets');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toBe('this is a normal log message with no secrets');
		});

		it('should redact sensitive data in error-level logs', () => {
			Logger.error('failed auth with .ROBLOSECURITY=leaked_token_here');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('.ROBLOSECURITY=[REDACTED]');
			expect(last.message).not.toContain('leaked_token_here');
		});

		it('should redact multiple sensitive patterns in the same message', () => {
			Logger.info('Cookie: session=abc and Bearer eyJtoken123 together');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('Cookie: [REDACTED]');
			expect(last.message).not.toContain('session=abc');
		});

		it('should handle case-insensitive ROBLOSECURITY', () => {
			Logger.info('.roblosecurity=CaseInsensitiveValue');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).not.toContain('CaseInsensitiveValue');
		});
	});

	describe('Value formatting in log buffer', () => {
		it('should format objects as JSON in the message', () => {
			Logger.info({ key: 'value', num: 42 });
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('key');
			expect(last.message).toContain('value');
			expect(last.message).toContain('42');
		});

		it('should format arrays in the message', () => {
			Logger.info([1, 2, 3]);
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('1');
			expect(last.message).toContain('2');
			expect(last.message).toContain('3');
		});

		it('should format null and undefined', () => {
			Logger.info(null, undefined);
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('null');
			expect(last.message).toContain('undefined');
		});

		it('should format Error objects', () => {
			Logger.info(new Error('test error'));
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('Error');
			expect(last.message).toContain('test error');
		});

		it('should format booleans', () => {
			Logger.info(true, false);
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('true');
			expect(last.message).toContain('false');
		});

		it('should format NaN', () => {
			Logger.info(NaN);
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('NaN');
		});

		it('should format functions', () => {
			Logger.info(function myFunc() {});
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('[Function: myFunc]');
		});

		it('should format Dates', () => {
			const date = new Date('2025-01-15T00:00:00.000Z');
			Logger.info(date);
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('2025-01-15');
		});

		it('should format RegExp', () => {
			Logger.info(/test-pattern/gi);
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('/test-pattern/gi');
		});

		it('should format Map objects', () => {
			const map = new Map([['a', 1]]);
			Logger.info(map);
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('a');
		});

		it('should format Set objects', () => {
			const set = new Set([10, 20, 30]);
			Logger.info(set);
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('10');
			expect(last.message).toContain('20');
			expect(last.message).toContain('30');
		});

		it('should format Promises as [Promise]', () => {
			Logger.info(Promise.resolve('x'));
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.message).toContain('[Promise]');
		});

		it('should redact sensitive data inside object values in formatted output', () => {
			Logger.info({ cookie: '.ROBLOSECURITY=supersecret123' });
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.formatted).not.toContain('supersecret123');
			expect(last.formatted).toContain('.ROBLOSECURITY=[REDACTED]');
		});
	});

	describe('Formatted log line structure', () => {
		it('should include app prefix and PID in formatted output', () => {
			Logger.info('pid test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.formatted).toMatch(/app\[\d+\]/);
		});

		it('should include the timestamp at the start of the formatted line', () => {
			Logger.info('timestamp format test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/);
		});

		it('should include the fileName in brackets in formatted output', () => {
			Logger.info('filename format test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.formatted).toMatch(/\[.+?\]/);
		});

		it('should include context in brackets when provided', () => {
			const ctx = Logger.withContext('FmtCtx');
			ctx.info('context format test');
			const entries = getLogBuffer();
			const last = entries[entries.length - 1];
			expect(last.formatted).toContain('[FmtCtx]');
		});
	});
});
