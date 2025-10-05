import { getValue } from '@/windows/main/components/settings';
import { RPCController, type RPCOptions } from '../../tools/rpc';
import type { GameEventInfo } from '../instance';
import type { RichPresence } from './types';

let rpcOptions: RPCOptions = {
	clientId: '1257650541677383721',
};

type GameMessage = string | { data: RichPresence; command: 'SetRichPresence' };

async function gameMessageEntry(messageData: GameEventInfo) {
	if ((await getValue<boolean>('integrations.sdk.enabled')) !== true) return; // For now, game messages are only used for the SDK.

	// Retrieve the message potential JSON
	const json = messageData.data.match(/\{.*\}/);
	if (!json) {
		console.error("[Activity] Couldn't retrieve GameMessage json");
		return;
	}
	let message: GameMessage = messageData.data;
	try {
		message = JSON.parse(json[0]);
	} catch (err) {
		return;
	}
	if (typeof message === 'string') return; // We don't need to respond to messages so why bother continue :P
	const { data, command } = message;
	switch (command) {
		case 'SetRichPresence':
			if (!((await getValue<boolean>('integrations.sdk.rpc')) === true)) return;
			rpcOptions = {
				...rpcOptions,
				enableTime: data.timeStart != null,
				details: data.details,
				state: data.state,
			};
			if (data.smallImage) {
				if (data.smallImage.hoverText) rpcOptions.smallImageText = data.smallImage.hoverText;
				rpcOptions.smallImage = `https://assetdelivery.roblox.com/v1/asset/?id=${data.smallImage.assetId}`;
			}
			if (data.largeImage) {
				if (data.largeImage.hoverText) rpcOptions.largeImage = data.largeImage.hoverText;
				rpcOptions.largeImage = `https://assetdelivery.roblox.com/v1/asset/?id=${data.largeImage.assetId}`;
			}
			RPCController.set(rpcOptions);
			break;
	}
}

export default gameMessageEntry;
