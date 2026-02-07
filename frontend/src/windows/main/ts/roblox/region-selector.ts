import { getValue } from '../../components/settings';
import { hasRobloxCookie } from './accounts';
import { getPublicServers, getServerRegionInfo, type RobloxServer } from './api';
import {
	fetchDatacenterList,
	getDatacenterById,
	getDatacentersInRegion,
	getServersInRegion,
	contributeServerData,
	formatDatacenterLocation,
	type Datacenter,
	AVAILABLE_REGIONS,
} from './rovalra-api';
import Logger from '@/windows/main/ts/utils/logger';

const logger = Logger.withContext('RegionSelector');

export interface RegionPreference {
	enabled: boolean;
	region: string;
	contributionConsent: boolean;
}

export interface ServerWithRegion extends RobloxServer {
	datacenter?: Datacenter | null;
	dataCenterId?: number | null;
}

export interface RegionSelectionResult {
	success: boolean;
	server?: ServerWithRegion;
	region?: Datacenter;
	message?: string;
	url?: string;
}

/**
 * Get the user's region preference from settings
 */
export async function getRegionPreference(): Promise<RegionPreference> {
	let enabled = false;
	let region = 'AUTO';
	let contributionConsent = false;

	try {
		enabled = (await getValue<boolean>('region.preferences.enabled')) === true;
	} catch {}

	try {
		region = (await getValue<string>('region.preferences.preferred_region')) || 'AUTO';
	} catch {}

	try {
		contributionConsent = (await getValue<boolean>('region.preferences.contribution_consent')) === true;
	} catch {}

	return {
		enabled,
		region,
		contributionConsent,
	};
}

/**
 * Check if region selection is available (requires auth)
 */
export async function isRegionSelectionAvailable(): Promise<boolean> {
	const hasCookie = await hasRobloxCookie();
	const preference = await getRegionPreference();

	return hasCookie && preference.enabled && preference.contributionConsent;
}

/**
 * Get servers and their regions for a specific game
 * This probes multiple servers to find their datacenter IDs
 */
export async function getServersWithRegions(placeId: string, maxServers = 10): Promise<ServerWithRegion[]> {
	logger.debug(`getServersWithRegions: placeId=${placeId}, maxServers=${maxServers}`);
	const serverList = await getPublicServers(placeId, undefined, 100);
	logger.debug(`Got ${serverList.data.length} servers from public server list`);
	const datacenters = await fetchDatacenterList();
	logger.debug(`Datacenter map has ${Object.keys(datacenters).length} entries`);

	const serversWithRegions: ServerWithRegion[] = [];

	const serversToProbe = serverList.data.slice(0, maxServers);

	for (const server of serversToProbe) {
		try {
			const regionInfo = await getServerRegionInfo(placeId, server.id);
			logger.debug(`Server ${server.id}: regionInfo.success=${regionInfo.success}, dataCenterId=${regionInfo.dataCenterId}`);

			if (regionInfo.success && regionInfo.dataCenterId !== null) {
				const datacenter = datacenters[regionInfo.dataCenterId] || null;
				logger.debug(`Server ${server.id}: dataCenterId=${regionInfo.dataCenterId}, datacenter=${datacenter ? `${datacenter.name} (${datacenter.region})` : 'NOT FOUND in map'}`);

				serversWithRegions.push({
					...server,
					dataCenterId: regionInfo.dataCenterId,
					datacenter,
				});

				contributeServerData({
					serverId: server.id,
					placeId,
					datacenterId: regionInfo.dataCenterId,
				}).catch(() => {});
			}

			await new Promise((resolve) => setTimeout(resolve, 100));
		} catch (error) {
			logger.warn(`Failed to get region for server ${server.id}:`, error);
		}
	}

	logger.info(`getServersWithRegions: found ${serversWithRegions.length}/${serversToProbe.length} servers with region info`);
	return serversWithRegions;
}

/**
 * Verify a server is still active by checking the live public server list.
 * Returns the fresh server data if found, or null if the server has closed.
 */
async function verifyServerStillActive(placeId: string, serverId: string): Promise<RobloxServer | null> {
	try {
		const liveServers = await getPublicServers(placeId, undefined, 100);
		const match = liveServers.data.find((s) => s.id === serverId);
		if (match) {
			logger.debug(`Server ${serverId} verified active (${match.playing}/${match.maxPlayers} players)`);
			return match;
		}
		logger.warn(`Server ${serverId} is no longer in the live server list`);
		return null;
	} catch (error) {
		logger.warn('Failed to verify server, proceeding anyway:', error);
		// If verification fails (e.g. network issue), let the join attempt proceed
		return { id: serverId, maxPlayers: 0, playing: 0, playerTokens: [] };
	}
}

/**
 * Find a server in the user's preferred region
 * First tries RoValra's direct region API, then falls back to probing servers.
 * Validates the server is still active before returning.
 */
export async function findServerInPreferredRegion(
	placeId: string,
	preferredRegion: string,
	maxAttempts = 20
): Promise<ServerWithRegion | null> {
	logger.info(`Searching for server in region: ${preferredRegion} (placeId=${placeId})`);

	if (preferredRegion === 'AUTO') {
		const serverList = await getPublicServers(placeId, undefined, 100);
		if (serverList.data.length === 0) {
			return null;
		}
		return {
			...serverList.data[0],
			dataCenterId: null,
			datacenter: null,
		};
	}

	// Try RoValra's direct region API first - much faster than probing
	const datacenters = await fetchDatacenterList();
	logger.debug(`Datacenter map: ${Object.keys(datacenters).length} entries`);

	const regionDatacenters = await getDatacentersInRegion(preferredRegion);
	logger.debug(`Found ${regionDatacenters.length} datacenters in region ${preferredRegion}`);

	// Try each unique city/country combo in this region via the RoValra servers API
	const triedLocations = new Set<string>();
	for (const dc of regionDatacenters) {
		const locationKey = `${dc.countryCode}:${dc.city}`;
		if (triedLocations.has(locationKey)) continue;
		triedLocations.add(locationKey);

		logger.debug(`Querying RoValra for servers in ${dc.city}, ${dc.countryCode}`);
		const servers = await getServersInRegion(placeId, dc.countryCode, dc.city);

		if (servers.length > 0) {
			// Try each candidate from the RoValra list until one is verified active
			for (const server of servers.slice(0, 3)) {
				const liveServer = await verifyServerStillActive(placeId, server.server_id);
				if (liveServer) {
					logger.info(`Found verified server via RoValra API in ${dc.city}, ${dc.countryCode}: ${server.server_id}`);
					return {
						id: liveServer.id,
						maxPlayers: liveServer.maxPlayers || server.max_players,
						playing: liveServer.playing || server.playing,
						playerTokens: liveServer.playerTokens || [],
						dataCenterId: dc.id,
						datacenter: dc,
					};
				}
			}
		}
	}

	logger.debug('RoValra direct API found no active servers, falling back to probe method');

	// Fallback: probe servers via join ticket
	const serverList = await getPublicServers(placeId, undefined, 100);
	if (serverList.data.length === 0) {
		logger.warn('No servers available for this game');
		return null;
	}

	// Build a set of currently live server IDs for quick validation
	const liveServerIds = new Set(serverList.data.map((s) => s.id));

	let attempts = 0;
	const probedServers: Set<string> = new Set();

	for (const server of serverList.data) {
		if (attempts >= maxAttempts) {
			break;
		}

		if (probedServers.has(server.id)) {
			continue;
		}
		probedServers.add(server.id);

		try {
			const regionInfo = await getServerRegionInfo(placeId, server.id);
			attempts++;
			logger.debug(`Probe #${attempts}: server=${server.id}, dataCenterId=${regionInfo.dataCenterId}`);

			if (regionInfo.success && regionInfo.dataCenterId !== null) {
				const datacenter = datacenters[regionInfo.dataCenterId];
				logger.debug(`Probe #${attempts}: datacenter=${datacenter ? `${datacenter.name} [${datacenter.region}]` : 'NOT FOUND'}, wanted=${preferredRegion}`);

				contributeServerData({
					serverId: server.id,
					placeId,
					datacenterId: regionInfo.dataCenterId,
				}).catch(() => {});

				if (datacenter && datacenter.region === preferredRegion) {
					// Server came from a fresh list so it should still be live,
					// but verify if probing took a long time
					if (!liveServerIds.has(server.id)) {
						const verified = await verifyServerStillActive(placeId, server.id);
						if (!verified) {
							logger.debug(`Skipping server ${server.id} - no longer active`);
							continue;
						}
					}

					logger.info(`Found server in ${preferredRegion}: ${server.id} (${formatDatacenterLocation(datacenter)})`);
					return {
						...server,
						dataCenterId: regionInfo.dataCenterId,
						datacenter,
					};
				}
			}

			await new Promise((resolve) => setTimeout(resolve, 150));
		} catch (error) {
			logger.warn(`Failed to probe server ${server.id}:`, error);
		}
	}

	logger.warn(`Could not find server in region ${preferredRegion} after ${attempts} attempts`);
	return null;
}

/**
 * Main entry point: Select a server based on user's region preference
 * Returns a modified URL if region selection is active, or null to use default joining
 */
export async function selectServerWithPreferredRegion(placeId: string, originalUrl: string): Promise<RegionSelectionResult> {
	const available = await isRegionSelectionAvailable();

	if (!available) {
		return {
			success: false,
			message: 'Region selection not available',
		};
	}

	const preference = await getRegionPreference();

	if (!preference.enabled) {
		return {
			success: false,
			message: 'Region selection disabled',
		};
	}

	if (preference.region === 'AUTO') {
		return {
			success: true,
			message: 'Using automatic region selection',
		};
	}

	try {
		const server = await findServerInPreferredRegion(placeId, preference.region);

		if (!server) {
			return {
				success: false,
				message: `No servers found in ${preference.region}. Try a different region.`,
			};
		}

		const newUrl = `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${server.id}`;

		return {
			success: true,
			server,
			region: server.datacenter || undefined,
			message: server.datacenter
				? `Joining server in ${formatDatacenterLocation(server.datacenter)}`
				: `Joining server in ${preference.region}`,
			url: newUrl,
		};
	} catch (error) {
		logger.error('Region selection failed:', error);
		return {
			success: false,
			message: `Region selection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
		};
	}
}

/**
 * Parse place ID from a Roblox URL
 */
export function parsePlaceIdFromUrl(url: string): string | null {
	try {
		const urlObj = new URL(url.replace('roblox-player://', 'https://').replace('roblox://', 'https://'));

		const placeId = urlObj.searchParams.get('placeId') || urlObj.searchParams.get('placeid');
		if (placeId) {
			return placeId;
		}

		const launchData = urlObj.searchParams.get('launchData');
		if (launchData) {
			try {
				const decoded = decodeURIComponent(launchData);
				const match = decoded.match(/placeId['":\s]+(\d+)/i);
				if (match) {
					return match[1];
				}
			} catch {}
		}

		return null;
	} catch {
		const match = url.match(/placeId[=:](\d+)/i);
		return match ? match[1] : null;
	}
}

/**
 * Get the display name for a region
 */
export function getRegionDisplayName(regionCode: string): string {
	const region = AVAILABLE_REGIONS.find((r) => r.value === regionCode);
	return region?.label || regionCode;
}

/**
 * Display notification about joined server region
 */
export async function getJoinedServerRegionInfo(dataCenterId: number): Promise<Datacenter | null> {
	const datacenter = await getDatacenterById(dataCenterId);

	if (datacenter) {
		logger.info(`Joined server in ${formatDatacenterLocation(datacenter)}`);
	}

	return datacenter;
}

export { AVAILABLE_REGIONS };

export default {
	getRegionPreference,
	isRegionSelectionAvailable,
	getServersWithRegions,
	findServerInPreferredRegion,
	selectServerWithPreferredRegion,
	parsePlaceIdFromUrl,
	getRegionDisplayName,
	getJoinedServerRegionInfo,
	AVAILABLE_REGIONS,
};
