import { getRobloxCookie, hasRobloxCookie } from '../tools/keychain';
import { secureRequest, secureGet } from '../tools/secure-http';
import { Curl } from '../tools/curl';
import { isRobloxDomain } from '../utils/security';
import Logger from '@/windows/main/ts/utils/logger';

const logger = Logger.withContext('RobloxAPI');

export interface RobloxServer {
	id: string;
	maxPlayers: number;
	playing: number;
	playerTokens: string[];
	fps?: number;
	ping?: number;
}

export interface ServerListResponse {
	previousPageCursor: string | null;
	nextPageCursor: string | null;
	data: RobloxServer[];
}

export interface JoinGameResponse {
	jobId: string;
	status: number;
	joinScript?: {
		DataCenterId?: number;
		MachineAddress?: string;
		ServerPort?: number;
		UdmuxEndpoints?: any[];
	};
	message?: string;
}

export interface UserInfo {
	id: number;
	name: string;
	displayName: string;
}

/**
 * Check if a URL is safe to send the cookie to
 * Uses the centralized security module for domain validation
 */
function isAllowedDomain(url: string): boolean {
	try {
		const parsedUrl = new URL(url);
		return isRobloxDomain(parsedUrl.hostname);
	} catch {
		return false;
	}
}

/**
 * Make an authenticated request to a Roblox API
 * SECURITY: Uses secure HTTP client - cookies are NOT visible in process arguments
 */
async function authenticatedRequest(
	url: string,
	options: {
		method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
		headers?: Record<string, string>;
		body?: string | Record<string, any>;
	} = {},
	requireAuth = true
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
	if (!isAllowedDomain(url)) {
		throw new Error(`Security Error: Attempted to send credentials to non-Roblox domain: ${url}`);
	}

	const cookie = await getRobloxCookie();

	if (requireAuth && !cookie) {
		throw new Error('No Roblox cookie stored. Please set up your account first.');
	}

	const headers: Record<string, string> = {
		'User-Agent': 'AppleBlox/1.0',
		Accept: 'application/json',
		...options.headers,
	};

	const cookies: Record<string, string> = {};
	if (cookie) {
		cookies['.ROBLOSECURITY'] = cookie;
	}

	const response = await secureRequest(url, {
		method: options.method || 'GET',
		headers,
		body: options.body,
		cookies: Object.keys(cookies).length > 0 ? cookies : undefined,
		timeout: 30,
	});

	if (!response.success && response.error) {
		throw new Error(response.error);
	}

	return {
		status: response.statusCode,
		body: response.body,
		headers: response.headers,
	};
}

/**
 * Get CSRF token for POST requests
 * Roblox requires this for authenticated POST/PUT/DELETE requests
 */
async function getCsrfToken(): Promise<string | null> {
	try {
		const response = await authenticatedRequest('https://auth.roblox.com/v2/logout', { method: 'POST' }, true);

		const token = response.headers['x-csrf-token'];
		return token || null;
	} catch (error) {
		logger.warn('Failed to get CSRF token:', error);
		return null;
	}
}

/**
 * Get the public server list for a game (no auth required)
 * Uses regular Curl since no sensitive data is involved
 */
export async function getPublicServers(
	placeId: string,
	cursor?: string,
	limit = 100,
	sortOrder: 'Asc' | 'Desc' = 'Desc'
): Promise<ServerListResponse> {
	const params = new URLSearchParams({
		limit: limit.toString(),
		sortOrder,
	});

	if (cursor) {
		params.set('cursor', cursor);
	}

	const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?${params}`;

	const response = await Curl.get(url, {
		headers: {
			Accept: 'application/json',
			'User-Agent': 'AppleBlox/1.0',
		},
	});

	if (!response.success || response.statusCode !== 200) {
		throw new Error(`Failed to get server list: ${response.statusCode || 'unknown'}`);
	}

	return JSON.parse(response.body || '{}');
}

/**
 * Get join ticket for a specific server (requires auth)
 * This returns the DataCenterId which we need for region detection
 */
export async function getJoinTicket(placeId: string, gameInstanceId: string): Promise<JoinGameResponse> {
	const csrfToken = await getCsrfToken();

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};

	if (csrfToken) {
		headers['x-csrf-token'] = csrfToken;
	}

	const response = await authenticatedRequest(
		'https://gamejoin.roblox.com/v1/join-game-instance',
		{
			method: 'POST',
			headers,
			body: {
				placeId: parseInt(placeId, 10),
				gameId: gameInstanceId,
				gameJoinAttemptId: crypto.randomUUID(),
				gamerTag: '',
				isPlayTogetherGame: false,
			},
		},
		true
	);

	if (response.status !== 200) {
		throw new Error(`Failed to get join ticket: ${response.status} - ${response.body}`);
	}

	return JSON.parse(response.body);
}

/**
 * Get current authenticated user info
 */
export async function getCurrentUser(): Promise<UserInfo | null> {
	try {
		const response = await authenticatedRequest('https://users.roblox.com/v1/users/authenticated', {}, true);

		if (response.status === 401) {
			return null;
		}

		if (response.status !== 200) {
			throw new Error(`Failed to get user info: ${response.status}`);
		}

		return JSON.parse(response.body);
	} catch (error) {
		logger.error('Failed to get current user:', error);
		return null;
	}
}

/**
 * Validate the stored Roblox cookie
 * Returns the user info if valid, null otherwise
 */
export async function validateCookie(): Promise<UserInfo | null> {
	const hasCookie = await hasRobloxCookie();
	if (!hasCookie) {
		return null;
	}

	try {
		return await getCurrentUser();
	} catch (error) {
		logger.error('Cookie validation failed:', error);
		return null;
	}
}

/**
 * Check if a cookie is authenticated (quick check)
 */
export async function isAuthenticated(): Promise<boolean> {
	const user = await validateCookie();
	return user !== null;
}

/**
 * Get detailed server info by querying join ticket
 * Returns DataCenterId for region detection
 */
export async function getServerRegionInfo(
	placeId: string,
	gameInstanceId: string
): Promise<{ dataCenterId: number | null; success: boolean }> {
	try {
		const joinInfo = await getJoinTicket(placeId, gameInstanceId);

		return {
			dataCenterId: joinInfo.joinScript?.DataCenterId ?? null,
			success: true,
		};
	} catch (error) {
		logger.error('Failed to get server region info:', error);
		return {
			dataCenterId: null,
			success: false,
		};
	}
}

export default {
	getPublicServers,
	getJoinTicket,
	getCurrentUser,
	validateCookie,
	isAuthenticated,
	getServerRegionInfo,
};
