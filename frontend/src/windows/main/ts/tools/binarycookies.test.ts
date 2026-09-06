import { describe, expect, it, mock } from 'bun:test';

mock.module('@neutralinojs/lib', () => ({
	os: { getEnv: mock(() => Promise.resolve('')) },
	events: {},
	filesystem: {},
	window: {},
	init: () => {},
}));

import {
	parseBinaryCookies,
	extractRoblosecurity,
	writeBinaryCookies,
	buildRoblosecurityFile,
	type ParsedCookie,
} from './binarycookies';

function makeCookie(overrides: Partial<ParsedCookie> = {}): ParsedCookie {
	return {
		name: '.ROBLOSECURITY',
		value: '_|WARNING:-DO-NOT-SHARE|_ABCDEF123456',
		domain: '.roblox.com',
		path: '/',
		flags: 0x5,
		expiry: new Date('2027-01-15T00:00:00Z'),
		creation: new Date('2026-01-15T00:00:00Z'),
		...overrides,
	};
}

describe('binarycookies', () => {
	describe('roundtrip: writeBinaryCookies -> parseBinaryCookies', () => {
		it('preserves name, value, domain, path, and flags for a single cookie', () => {
			const original = makeCookie();
			const buffer = writeBinaryCookies([original]);
			const parsed = parseBinaryCookies(buffer);

			expect(parsed).toHaveLength(1);
			expect(parsed[0].name).toBe(original.name);
			expect(parsed[0].value).toBe(original.value);
			expect(parsed[0].domain).toBe(original.domain);
			expect(parsed[0].path).toBe(original.path);
			expect(parsed[0].flags).toBe(original.flags);
		});

		it('preserves expiry and creation dates within 1 second precision', () => {
			const original = makeCookie();
			const parsed = parseBinaryCookies(writeBinaryCookies([original]))[0];

			expect(Math.abs(parsed.expiry!.getTime() - original.expiry!.getTime())).toBeLessThan(1000);
			expect(Math.abs(parsed.creation!.getTime() - original.creation!.getTime())).toBeLessThan(1000);
		});

		it('handles multiple cookies', () => {
			const cookies = [
				makeCookie({ name: 'cookie_a', value: 'val_a', domain: '.example.com' }),
				makeCookie({ name: 'cookie_b', value: 'val_b', domain: '.test.com', flags: 0x1 }),
				makeCookie({ name: 'cookie_c', value: 'val_c', path: '/subpath' }),
			];
			const parsed = parseBinaryCookies(writeBinaryCookies(cookies));

			expect(parsed).toHaveLength(3);
			for (let i = 0; i < cookies.length; i++) {
				expect(parsed[i].name).toBe(cookies[i].name);
				expect(parsed[i].value).toBe(cookies[i].value);
				expect(parsed[i].domain).toBe(cookies[i].domain);
				expect(parsed[i].path).toBe(cookies[i].path);
				expect(parsed[i].flags).toBe(cookies[i].flags);
			}
		});
	});

	describe('parseBinaryCookies', () => {
		it('throws on invalid magic header', () => {
			const buf = new ArrayBuffer(8);
			const view = new DataView(buf);
			view.setUint32(0, 0x62616421, false); // "bad!"
			expect(() => parseBinaryCookies(buf)).toThrow('Not a binarycookies file');
		});
	});

	describe('extractRoblosecurity', () => {
		it('returns the correct cookie value', () => {
			const cookies = [
				makeCookie({ name: 'other', value: 'irrelevant' }),
				makeCookie({ value: 'the_secret_token' }),
			];
			expect(extractRoblosecurity(cookies)).toBe('the_secret_token');
		});

		it('returns null when no ROBLOSECURITY cookie exists', () => {
			const cookies = [makeCookie({ name: 'session_id', value: 'abc' })];
			expect(extractRoblosecurity(cookies)).toBeNull();
		});

		it('ignores ROBLOSECURITY cookies on wrong domain', () => {
			const cookies = [makeCookie({ domain: '.evil.com' })];
			expect(extractRoblosecurity(cookies)).toBeNull();
		});
	});

	describe('buildRoblosecurityFile', () => {
		it('produces a parseable file with the correct ROBLOSECURITY cookie', () => {
			const token = '_|WARNING:-DO-NOT-SHARE|_TEST_TOKEN_XYZ';
			const buffer = buildRoblosecurityFile(token);
			const cookies = parseBinaryCookies(buffer);

			expect(cookies).toHaveLength(1);
			expect(cookies[0].name).toBe('.ROBLOSECURITY');
			expect(cookies[0].value).toBe(token);
			expect(cookies[0].domain).toBe('.roblox.com');
			expect(cookies[0].path).toBe('/');
			expect(cookies[0].flags).toBe(0x5);
			expect(cookies[0].expiry).not.toBeNull();
			expect(cookies[0].creation).not.toBeNull();
		});
	});
});
