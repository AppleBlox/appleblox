import { filesystem } from '@neutralinojs/lib';
import path from 'path-browserify';
import { getValue } from '../../components/settings';
import { getDataDir } from '../utils/paths';
import Logger from '@/windows/main/ts/utils/logger';

const logger = Logger.withContext('RoValraAPI');

const ROVALRA_API_BASE = 'https://apis.rovalra.com';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

export interface Datacenter {
	id: number;
	name: string;
	city: string;
	state: string;
	country: string;
	countryCode: string;
	latitude: number;
	longitude: number;
	region: string;
}

export interface DatacenterMap {
	[id: number]: Datacenter;
}

export interface ServerContribution {
	serverId: string;
	placeId: string;
	datacenterId: number;
}

export const REGION_GROUPS: { [key: string]: { name: string; countries: string[] } } = {
	'US-EAST': {
		name: 'US East',
		countries: ['US'],
	},
	'US-WEST': {
		name: 'US West',
		countries: ['US'],
	},
	'US-CENTRAL': {
		name: 'US Central',
		countries: ['US'],
	},
	EU: {
		name: 'Europe',
		countries: ['DE', 'GB', 'NL', 'FR', 'PL', 'IE'],
	},
	ASIA: {
		name: 'Asia',
		countries: ['JP', 'SG', 'HK', 'KR', 'IN'],
	},
	OCEANIA: {
		name: 'Oceania',
		countries: ['AU', 'NZ'],
	},
	'SOUTH-AMERICA': {
		name: 'South America',
		countries: ['BR', 'CL', 'AR'],
	},
};

export const AVAILABLE_REGIONS = [
	{ value: 'AUTO', label: 'Automatic (Best)' },
	{ value: 'US-EAST', label: 'US East' },
	{ value: 'US-WEST', label: 'US West' },
	{ value: 'US-CENTRAL', label: 'US Central' },
	{ value: 'EU', label: 'Europe' },
	{ value: 'ASIA', label: 'Asia' },
	{ value: 'OCEANIA', label: 'Oceania' },
	{ value: 'SOUTH-AMERICA', label: 'South America' },
];

let cachedDatacenters: DatacenterMap | null = null;
let cacheTimestamp: number = 0;

/**
 * Get the path to the datacenter cache file
 */
async function getCachePath(): Promise<string> {
	const dataDir = await getDataDir();
	return path.join(dataDir, 'cache', 'datacenters.json');
}

/**
 * Load cached datacenter map from disk
 */
async function loadCachedDatacenters(): Promise<{ data: DatacenterMap; timestamp: number } | null> {
	try {
		const cachePath = await getCachePath();
		const content = await filesystem.readFile(cachePath);
		const parsed = JSON.parse(content);

		if (parsed && parsed.data && parsed.timestamp) {
			return parsed;
		}
	} catch {}
	return null;
}

/**
 * Save datacenter map to disk cache
 */
async function saveCachedDatacenters(data: DatacenterMap): Promise<void> {
	try {
		const cachePath = await getCachePath();
		const cacheDir = path.dirname(cachePath);

		try {
			await filesystem.createDirectory(cacheDir);
		} catch {}

		const cacheData = {
			data,
			timestamp: Date.now(),
		};

		await filesystem.writeFile(cachePath, JSON.stringify(cacheData));
	} catch (error) {
		logger.warn('Failed to save datacenter cache:', error);
	}
}

/**
 * Fetch the datacenter list from RoValra's API
 */
export async function fetchDatacenterList(): Promise<DatacenterMap> {
	if (cachedDatacenters && Date.now() - cacheTimestamp < CACHE_DURATION_MS) {
		return cachedDatacenters;
	}

	const diskCache = await loadCachedDatacenters();
	if (diskCache && Date.now() - diskCache.timestamp < CACHE_DURATION_MS) {
		cachedDatacenters = diskCache.data;
		cacheTimestamp = diskCache.timestamp;
		return cachedDatacenters;
	}

	try {
		const response = await fetch(`${ROVALRA_API_BASE}/v1/datacenters/list`);

		if (!response.ok) {
			throw new Error(`Failed to fetch datacenters: ${response.status}`);
		}

		const data = await response.json();

		const datacenterMap: DatacenterMap = {};
		if (Array.isArray(data)) {
			for (const dc of data) {
				datacenterMap[dc.id] = {
					id: dc.id,
					name: dc.name || 'Unknown',
					city: dc.city || 'Unknown',
					state: dc.state || '',
					country: dc.country || 'Unknown',
					countryCode: dc.countryCode || dc.country_code || '',
					latitude: dc.latitude || dc.lat || 0,
					longitude: dc.longitude || dc.lon || dc.lng || 0,
					region: determineRegion(dc),
				};
			}
		}

		cachedDatacenters = datacenterMap;
		cacheTimestamp = Date.now();
		await saveCachedDatacenters(datacenterMap);

		logger.info(`Fetched ${Object.keys(datacenterMap).length} datacenters from RoValra`);
		return datacenterMap;
	} catch (error) {
		logger.error('Failed to fetch datacenters:', error);

		if (diskCache) {
			cachedDatacenters = diskCache.data;
			cacheTimestamp = diskCache.timestamp;
			return cachedDatacenters;
		}

		return {};
	}
}

interface DatacenterInput {
	countryCode?: string;
	country_code?: string;
	city?: string;
	name?: string;
}

/**
 * Determine the region for a datacenter based on its location
 */
function determineRegion(dc: DatacenterInput): string {
	const country = (dc.countryCode || dc.country_code || '').toUpperCase();
	const city = (dc.city || '').toLowerCase();
	const name = (dc.name || '').toLowerCase();

	if (country === 'US') {
		const eastCities = ['ashburn', 'virginia', 'atlanta', 'miami', 'new york', 'newark', 'washington'];
		const westCities = ['los angeles', 'san jose', 'seattle', 'phoenix', 'denver', 'las vegas', 'california'];
		const centralCities = ['dallas', 'chicago', 'kansas', 'houston', 'texas'];

		if (eastCities.some((c) => city.includes(c) || name.includes(c))) {
			return 'US-EAST';
		}
		if (westCities.some((c) => city.includes(c) || name.includes(c))) {
			return 'US-WEST';
		}
		if (centralCities.some((c) => city.includes(c) || name.includes(c))) {
			return 'US-CENTRAL';
		}

		return 'US-EAST';
	}

	if (['DE', 'GB', 'UK', 'NL', 'FR', 'PL', 'IE', 'ES', 'IT', 'SE', 'FI', 'NO', 'DK'].includes(country)) {
		return 'EU';
	}

	if (['JP', 'SG', 'HK', 'KR', 'IN', 'TW', 'TH', 'MY', 'ID', 'PH', 'VN', 'CN'].includes(country)) {
		return 'ASIA';
	}

	if (['AU', 'NZ'].includes(country)) {
		return 'OCEANIA';
	}

	if (['BR', 'CL', 'AR', 'CO', 'PE', 'MX'].includes(country)) {
		return 'SOUTH-AMERICA';
	}

	return 'OTHER';
}

/**
 * Get datacenter info by ID
 */
export async function getDatacenterById(id: number): Promise<Datacenter | null> {
	const datacenters = await fetchDatacenterList();
	return datacenters[id] || null;
}

/**
 * Get all datacenters in a specific region
 */
export async function getDatacentersInRegion(region: string): Promise<Datacenter[]> {
	const datacenters = await fetchDatacenterList();
	return Object.values(datacenters).filter((dc) => dc.region === region);
}

/**
 * Contribute server data back to RoValra
 * This is required in exchange for using their datacenter database
 * IMPORTANT: Only sends server ID, place ID, and datacenter ID - NO user data
 */
export async function contributeServerData(contribution: ServerContribution): Promise<boolean> {
	const hasConsent = await getValue<boolean>('region.preferences.contribution_consent');

	if (!hasConsent) {
		logger.debug('Data contribution skipped: user has not consented');
		return false;
	}

	try {
		const payload = {
			server_id: contribution.serverId,
			place_id: contribution.placeId,
			datacenter_id: contribution.datacenterId,
		};

		const response = await fetch(`${ROVALRA_API_BASE}/v1/servers/contribute`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Client': 'AppleBlox',
			},
			body: JSON.stringify(payload),
		});

		if (response.ok) {
			logger.debug('Successfully contributed server data');
			return true;
		} else {
			logger.warn(`Failed to contribute server data: ${response.status}`);
			return false;
		}
	} catch (error) {
		logger.warn('Failed to contribute server data:', error);
		return false;
	}
}

/**
 * Calculate distance between two geographic coordinates (Haversine formula)
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

/**
 * Get the closest datacenter to a given location
 */
export async function getClosestDatacenter(latitude: number, longitude: number): Promise<Datacenter | null> {
	const datacenters = await fetchDatacenterList();
	let closest: Datacenter | null = null;
	let minDistance = Infinity;

	for (const dc of Object.values(datacenters)) {
		const distance = calculateDistance(latitude, longitude, dc.latitude, dc.longitude);
		if (distance < minDistance) {
			minDistance = distance;
			closest = dc;
		}
	}

	return closest;
}

/**
 * Format datacenter location for display
 */
export function formatDatacenterLocation(datacenter: Datacenter): string {
	const parts: string[] = [];

	if (datacenter.city && datacenter.city !== 'Unknown') {
		parts.push(datacenter.city);
	}

	if (datacenter.state) {
		parts.push(datacenter.state);
	}

	if (datacenter.country && datacenter.country !== 'Unknown') {
		parts.push(datacenter.country);
	}

	return parts.join(', ') || 'Unknown Location';
}

export default {
	fetchDatacenterList,
	getDatacenterById,
	getDatacentersInRegion,
	contributeServerData,
	calculateDistance,
	getClosestDatacenter,
	formatDatacenterLocation,
	AVAILABLE_REGIONS,
	REGION_GROUPS,
};
