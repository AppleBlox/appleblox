import { describe, expect, it, beforeEach, mock, spyOn } from 'bun:test';

describe('Logger', () => {
	beforeEach(() => {
		// Mock console methods
		global.console = {
			...console,
			log: mock(() => {}),
			warn: mock(() => {}),
			error: mock(() => {}),
			info: mock(() => {}),
		};
	});

	describe('Basic Logging', () => {
		it('should import without errors', async () => {
			const { default: Logger } = await import('./logger');
			expect(Logger).toBeDefined();
			expect(Logger.info).toBeDefined();
			expect(Logger.warn).toBeDefined();
			expect(Logger.error).toBeDefined();
		});

		it('should support withContext for creating contextual loggers', async () => {
			const { default: Logger } = await import('./logger');
			const contextLogger = Logger.withContext('TestContext');
			expect(contextLogger).toBeDefined();
			expect(contextLogger.info).toBeDefined();
		});
	});
});
