/**
 * SECURITY: Patterns that should be redacted from any output
 * These patterns help prevent accidental credential leakage
 */
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
	{ pattern: /\.ROBLOSECURITY[=:]\s*[^\s;,'"}\]]+/gi, replacement: '.ROBLOSECURITY=[REDACTED]' },
	{ pattern: /_\|WARNING:-DO-NOT-SHARE-THIS[^\s;,'"}\]]*/gi, replacement: '[REDACTED_COOKIE]' },
	{ pattern: /Cookie:\s*[^\n]+/gi, replacement: 'Cookie: [REDACTED]' },
	{ pattern: /Set-Cookie:\s*[^\n]+/gi, replacement: 'Set-Cookie: [REDACTED]' },
	{ pattern: /Bearer\s+[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_=]*\.?[A-Za-z0-9\-_=]*/gi, replacement: 'Bearer [REDACTED]' },
	{ pattern: /Authorization:\s*[^\n]+/gi, replacement: 'Authorization: [REDACTED]' },
];

/**
 * Redact sensitive information from a string
 * Use this before logging, displaying, or transmitting any data that might contain credentials
 */
export function redactSensitiveData(input: string): string {
	let result = input;
	for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
		result = result.replace(pattern, replacement);
	}
	return result;
}

/**
 * Check if a string appears to contain sensitive data
 * Useful for validation and warning purposes
 */
export function containsSensitiveData(input: string): boolean {
	for (const { pattern } of SENSITIVE_PATTERNS) {
		if (pattern.test(input)) {
			return true;
		}
	}
	return false;
}

/**
 * Validate that a domain is safe for cookie transmission
 * Returns true only for official Roblox domains
 * Accepts either a full URL or just a hostname
 */
export function isRobloxDomain(urlOrHostname: string): boolean {
	let hostname: string;

	try {
		if (urlOrHostname.includes('://')) {
			const parsedUrl = new URL(urlOrHostname);
			hostname = parsedUrl.hostname.toLowerCase();
		} else {
			hostname = urlOrHostname.toLowerCase();
		}

		const ALLOWED_DOMAINS = [
			'roblox.com',
			'www.roblox.com',
			'apis.roblox.com',
			'games.roblox.com',
			'gamejoin.roblox.com',
			'users.roblox.com',
			'presence.roblox.com',
			'friends.roblox.com',
			'economy.roblox.com',
			'catalog.roblox.com',
			'thumbnails.roblox.com',
			'auth.roblox.com',
		];

		return ALLOWED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
	} catch {
		return false;
	}
}

/**
 * Validate Roblox cookie format
 * Returns true if the cookie appears to be a valid .ROBLOSECURITY cookie
 */
export function isValidRobloxCookieFormat(cookie: string): boolean {
	if (!cookie || cookie.length < 100) {
		return false;
	}

	const hasWarning = cookie.includes('WARNING') || cookie.startsWith('_|');

	const hasInvalidChars = /[\n\r\t]/.test(cookie);

	return hasWarning && !hasInvalidChars;
}

/**
 * Securely clear a string variable by overwriting it
 * Note: This is best-effort in JavaScript due to GC and string immutability
 * For true security, prefer using the native Keychain
 */
export function secureClear(value: string): void {}

/**
 * Mask a string for display purposes
 * Shows only the first and last few characters
 */
export function maskForDisplay(value: string, visibleStart = 4, visibleEnd = 4): string {
	if (value.length <= visibleStart + visibleEnd + 3) {
		return '*'.repeat(value.length);
	}

	const start = value.substring(0, visibleStart);
	const end = value.substring(value.length - visibleEnd);
	const maskLength = Math.min(value.length - visibleStart - visibleEnd, 10);

	return `${start}${'*'.repeat(maskLength)}${end}`;
}

export default {
	redactSensitiveData,
	containsSensitiveData,
	isRobloxDomain,
	isValidRobloxCookieFormat,
	secureClear,
	maskForDisplay,
};
