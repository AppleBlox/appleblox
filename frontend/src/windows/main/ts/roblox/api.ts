import { getRobloxCookie, hasRobloxCookie } from './accounts';
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
export async function authenticatedRequest(
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
export async function getCsrfToken(): Promise<string | null> {
	try {
		const response = await authenticatedRequest('https://auth.roblox.com/v2/logout', { method: 'POST' }, true);

		const token = response.headers['x-csrf-token'];
		if (!token) logger.error(response)
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
	logger.debug(`getJoinTicket: placeId=${placeId}, gameInstanceId=${gameInstanceId}`);
	const csrfToken = await getCsrfToken();
	logger.debug(`CSRF token obtained: ${csrfToken ? 'yes' : 'no'}`);

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
			},
		},
		true
	);

	if (response.status !== 200) {
		logger.error(`Join ticket failed: status=${response.status}, body=${response.body.substring(0, 300)}`);
		throw new Error(`Failed to get join ticket: ${response.status} - ${response.body}`);
	}

	const parsed = JSON.parse(response.body);
	logger.debug(`Join ticket parsed: jobId=${parsed.jobId}, status=${parsed.status}, joinScript keys=${parsed.joinScript ? Object.keys(parsed.joinScript).join(',') : 'none'}`);
	if (parsed.status !== 2 && !parsed.joinScript) {
		logger.warn(`Join ticket non-success: status=${parsed.status}, message=${parsed.message || 'none'}, raw=${response.body.substring(0, 500)}`);
	}
	return parsed;
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
 * Validate an arbitrary cookie (not yet stored) by making an authenticated API call.
 * Used by the account manager to verify cookies before storing them.
 */
export async function validateArbitraryCookie(cookie: string): Promise<UserInfo | null> {
	if (!cookie || cookie.length < 100) return null;
	try {
		const response = await secureRequest('https://users.roblox.com/v1/users/authenticated', {
			method: 'GET',
			headers: {
				'User-Agent': 'AppleBlox/1.0',
				Accept: 'application/json',
			},
			cookies: { '.ROBLOSECURITY': cookie },
			timeout: 30,
		});

		if (!response.success || response.statusCode !== 200) {
			return null;
		}

		return JSON.parse(response.body) as UserInfo;
	} catch {
		return null;
	}
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
		logger.debug(`getServerRegionInfo: placeId=${placeId}, gameInstanceId=${gameInstanceId}`);
		const joinInfo = await getJoinTicket(placeId, gameInstanceId);
		logger.debug(`Join ticket response: status=${joinInfo.status}, hasJoinScript=${!!joinInfo.joinScript}, DataCenterId=${joinInfo.joinScript?.DataCenterId}, MachineAddress=${joinInfo.joinScript?.MachineAddress}`);

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

/**
 * Fetch the user's recently played games from Roblox API
 * Uses the omni-recommendation discovery API (same as the website's home page)
 * then enriches with game details and icons
 */
export async function getRecentGames(
	maxGames = 50
): Promise<
	Array<{
		placeId: string;
		universeId: string;
		name: string;
		creator: string;
		iconUrl: string;
		lastPlayed: number;
	}>
> {
	try {
		const hasCookie = await hasRobloxCookie();
		if (!hasCookie) {
			return [];
		}

		// Use the discovery omni-recommendation API (what the Roblox website uses)
		const response = await authenticatedRequest(
			'https://apis.roblox.com/discovery-api/omni-recommendation',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: {
					pageType: 'Home',
					sessionId: crypto.randomUUID(),
					isTruncatedResultsEnabled: true,
				},
			},
			true
		);

		if (response.status !== 200) {
			logger.warn(`Discovery API failed: ${response.status}, body: ${response.body.substring(0, 200)}`);
			return [];
		}

		const data = JSON.parse(response.body);
		const sorts: Array<{
			topic: string;
			treatmentType: string;
			recommendationList: Array<{ contentType: string; contentId: number }>;
		}> = data.sorts || [];

		// Find the "Continue Playing" / recently played sort
		const recentSort = sorts.find(
			(s) =>
				s.topic?.includes('Continue') ||
				s.topic?.includes('Recent') ||
				s.topic?.includes('continue') ||
				s.topic?.includes('Revisit')
		);

		if (!recentSort) {
			logger.warn(
				'Could not find Continue Playing sort. Available topics:',
				sorts.map((s) => s.topic).join(', ')
			);
			return [];
		}

		logger.debug(`Found recent games sort: "${recentSort.topic}" with ${recentSort.recommendationList?.length || 0} games`);

		// Extract universe IDs from the recommendation list
		const universeIds = (recentSort.recommendationList || [])
			.filter((r) => r.contentType === 'Game' || r.contentType === 'game' || r.contentId > 0)
			.map((r) => r.contentId)
			.slice(0, maxGames);

		if (universeIds.length === 0) {
			logger.debug('No universe IDs in Continue Playing sort');
			return [];
		}

		// Fetch game details and icons in parallel
		const [detailsRes, iconsRes] = await Promise.all([
			Curl.get(`https://games.roblox.com/v1/games?universeIds=${universeIds.join(',')}`, {
				headers: { Accept: 'application/json', 'User-Agent': 'AppleBlox/1.0' },
			}),
			Curl.get(
				`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds.join(',')}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`,
				{
					headers: { Accept: 'application/json', 'User-Agent': 'AppleBlox/1.0' },
				}
			),
		]);

		const detailsMap: Record<number, { name: string; creator: string; rootPlaceId: number }> = {};
		if (detailsRes.success && detailsRes.body) {
			const detailsData = JSON.parse(detailsRes.body);
			for (const game of detailsData.data || []) {
				detailsMap[game.id] = {
					name: game.name,
					creator: game.creator?.name || 'Unknown',
					rootPlaceId: game.rootPlaceId,
				};
			}
		}

		const iconsMap: Record<number, string> = {};
		if (iconsRes.success && iconsRes.body) {
			const iconsData = JSON.parse(iconsRes.body);
			for (const icon of iconsData.data || []) {
				iconsMap[icon.targetId] = icon.imageUrl;
			}
		}

		logger.debug(`Enriched ${Object.keys(detailsMap).length} games, ${Object.keys(iconsMap).length} icons`);

		// Map in the original order from the recommendation list
		return universeIds
			.map((uid) => {
				const details = detailsMap[uid];
				if (!details) return null;

				return {
					placeId: String(details.rootPlaceId),
					universeId: String(uid),
					name: details.name,
					creator: details.creator,
					iconUrl: iconsMap[uid] || '',
					lastPlayed: Date.now(),
				};
			})
			.filter(Boolean) as Array<{
			placeId: string;
			universeId: string;
			name: string;
			creator: string;
			iconUrl: string;
			lastPlayed: number;
		}>;
	} catch (error) {
		logger.warn('Failed to fetch recent games:', error);
		return [];
	}
}

export default {
	getPublicServers,
	getJoinTicket,
	getCurrentUser,
	validateCookie,
	validateArbitraryCookie,
	isAuthenticated,
	getServerRegionInfo,
	getRecentGames,
};
