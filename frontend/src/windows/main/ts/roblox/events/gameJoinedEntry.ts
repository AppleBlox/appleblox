import { getValue } from '@/windows/main/components/settings';
import { Notification } from '../../tools/notifications';
import { curlGet } from '../../utils';
import type { GameEventInfo } from '../instance';

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
	console.info(`[Activity] Current server: ${server[0]}, Port: ${server[1]}`);
	if ((await getValue<boolean>('integrations.activity.notify_location')) === true) {
		const ipReq: IPResponse = await curlGet(`https://ipinfo.io/${server[0]}/json`);
		console.info(`[Activity] Server is located in "${ipReq.city}"`);

		new Notification({
			content: `Your server is located in ${ipReq.city}, ${ipReq.region}, ${ipReq.country}`,
			title: 'Server Joined',
			timeout: 5,
			sound: 'frog',
		}).show();
	}
}

export default gameJoinedEntry;
