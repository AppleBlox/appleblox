import { getValue } from '@/windows/main/components/settings';
import { Notification } from '../../tools/notifications';
import type { GameEventInfo } from '../instance';
import Logger from '@/windows/main/ts/utils/logger';
import { Curl } from '../../tools/curl';

interface IPResponse {
	ip: string;
	city: string;
	region: string;
	country: string;
	loc: string;
	org: string;
	postal: string;
	timezone: string;
	readme: string;
}

let lastJoinedServerIP: string | null = null;
async function gameJoinedEntry(data: GameEventInfo) {
	// Add the join server button
	const server = data.data.substring(10).split('|');
	// Prevent notifications spam (compare by IP address value, not array reference)
	if (server[0] === lastJoinedServerIP) return;
	lastJoinedServerIP = server[0];
	Logger.info(`Current server: ${server[0]}, Port: ${server[1]}`);

	// Get settings with defaults (true) if they don't exist yet
	let notifyLocation = true;
	let historyEnabled = true;
	try {
		notifyLocation = (await getValue<boolean>('integrations.activity.notify_location')) === true;
	} catch {
		// Setting doesn't exist yet, use default
	}
	try {
		historyEnabled = (await getValue<boolean>('history.tracking.enabled')) !== false;
	} catch {
		// Setting doesn't exist yet, use default
	}

	// Only fetch IP info if we need it for notifications or history
	if (notifyLocation || historyEnabled) {
		try {
			const response = await Curl.get(`https://ipinfo.io/${server[0]}/json`);
			if (!response.success || !response.body) {
				throw new Error(`Failed to fetch version info: ${response.error || 'No response body'}`);
			}
			const ipReq: IPResponse = JSON.parse(response.body);
			Logger.info(`Server is located in "${ipReq.city}"`);

			// Capture server for activity history
			if (historyEnabled) {
				try {
					const { ActivityHistoryManager, getEventContext } = await import('../../activity');
					const ctx = getEventContext();
					if (ctx) {
						await ActivityHistoryManager.addServerToGame(ctx.placeId, {
							jobId: ctx.jobId,
							serverIP: server[0],
							joinedAt: Date.now(),
							region: { city: ipReq.city, region: ipReq.region, country: ipReq.country },
						});
					}
				} catch (error) {
					Logger.error('Failed to add server to activity history:', error);
				}
			}

			// Show notification if enabled
			if (notifyLocation) {
				new Notification({
					content: `Your server is located in ${ipReq.city}, ${ipReq.region}, ${ipReq.country}`,
					title: 'Server Joined',
					timeout: 5,
					sound: 'frog',
				}).show();
			}
		} catch {
			if (notifyLocation) {
				new Notification({
					content: "Something wrong happened while displaying server's region",
					title: 'An error occured',
					timeout: 5,
					sound: 'hero',
				});
			}
		}
	}
}

export default gameJoinedEntry;
