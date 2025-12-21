/**
 * Global test setup for Bun tests
 * Mocks browser and Neutralino environment
 */

// Mock window object
if (typeof window === 'undefined') {
	(global as any).window = {
		NL_ARGS: [],
		NL_TOKEN: 'test-token',
		NL_PORT: 5000,
		NL_OS: 'Darwin',
		addEventListener: () => {},
		dispatchEvent: () => {},
		location: {
			hostname: 'localhost',
		},
		sessionStorage: {
			setItem: () => {},
			getItem: () => null,
		},
		atob: (str: string) => Buffer.from(str, 'base64').toString('binary'),
		btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
		WebSocket: class MockWebSocket {
			constructor() {}
			send() {}
			close() {}
		},
		CustomEvent: class MockCustomEvent {
			constructor(
				public type: string,
				public detail: any
			) {}
		},
	};
}

// Mock document object
if (typeof document === 'undefined') {
	(global as any).document = {
		getElementById: () => null,
	};
}

// Export for use in tests
export {};
