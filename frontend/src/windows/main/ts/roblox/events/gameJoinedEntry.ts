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

let lastJoinedServer: string[] | null = null;
async function gameJoinedEntry(data: GameEventInfo) {
	// Add the join server button
	const server = data.data.substring(10).split('|');
	// Prevent notifications spam
	if (server === lastJoinedServer) return;
	lastJoinedServer = server;
	Logger.info(`Current server: ${server[0]}, Port: ${server[1]}`);
	if ((await getValue<boolean>('integrations.activity.notify_location')) === true) {
		try {
			const response = await Curl.get(`https://ipinfo.io/${server[0]}/json`);
			if (!response.success || !response.body) {
				throw new Error(`Failed to fetch version info: ${response.error || 'No response body'}`);
			}
			const ipReq: IPResponse = JSON.parse(response.body);
			Logger.info(`Server is located in "${ipReq.city}"`);

			new Notification({
				content: `Your server is located in ${ipReq.city}, ${ipReq.region}, ${ipReq.country}`,
				title: 'Server Joined',
				timeout: 5,
				sound: 'frog',
			}).show();
		} catch {
			new Notification({
				content: "Something wrong happened while displaying server's region",
				title: 'An error occured',
				timeout: 5,
				sound: 'hero',
			});
		}
	}
}

export default gameJoinedEntry;
