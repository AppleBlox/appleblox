import { getValue } from '../../components/settings';
import { hasRobloxCookie } from '../tools/keychain';
import { getPublicServers, getServerRegionInfo, type RobloxServer } from './api';
import {
	fetchDatacenterList,
	getDatacenterById,
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
	const serverList = await getPublicServers(placeId, undefined, 100);
	const datacenters = await fetchDatacenterList();

	const serversWithRegions: ServerWithRegion[] = [];

	const serversToProbe = serverList.data.slice(0, maxServers);

	for (const server of serversToProbe) {
		try {
			const regionInfo = await getServerRegionInfo(placeId, server.id);

			if (regionInfo.success && regionInfo.dataCenterId !== null) {
				const datacenter = datacenters[regionInfo.dataCenterId] || null;

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

	return serversWithRegions;
}

/**
 * Find a server in the user's preferred region
 */
export async function findServerInPreferredRegion(
	placeId: string,
	preferredRegion: string,
	maxAttempts = 20
): Promise<ServerWithRegion | null> {
	logger.info(`Searching for server in region: ${preferredRegion}`);

	const serverList = await getPublicServers(placeId, undefined, 100);
	const datacenters = await fetchDatacenterList();

	if (serverList.data.length === 0) {
		logger.warn('No servers available for this game');
		return null;
	}

	if (preferredRegion === 'AUTO') {
		const server = serverList.data[0];
		return {
			...server,
			dataCenterId: null,
			datacenter: null,
		};
	}

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

			if (regionInfo.success && regionInfo.dataCenterId !== null) {
				const datacenter = datacenters[regionInfo.dataCenterId];

				contributeServerData({
					serverId: server.id,
					placeId,
					datacenterId: regionInfo.dataCenterId,
				}).catch(() => {});

				if (datacenter && datacenter.region === preferredRegion) {
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
