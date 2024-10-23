import { getValue } from '@/windows/main/components/settings';
import { RPCController, type RPCOptions } from '../../tools/rpc';
import type { GameEventInfo } from '../instance';
import { RobloxWindow, type WindowData } from '../window';
import type { RichPresence, SetWindowData } from './types';
import { sleep } from '../../utils';

let rpcOptions: RPCOptions = {
	clientId: '1257650541677383721',
};

type GameMessage =
	| string
	| { data: RichPresence; command: 'SetRichPresence' }
	| { data: SetWindowData; command: 'SetWindow' }
	| { data: never; command: 'RestoreWindowState' | 'RestoreWindow' | 'ResetWindow' }
	| { data: never; command: 'SaveWindowState' | 'SetWindowDefault' };

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
		case 'SetWindow':
			if (data.reset) {
				RobloxWindow.reset();
				return;
			}

			let params: Partial<WindowData> = {};
			if (data.x) params.x = data.x;
			if (data.y) params.y = data.y;
			if (data.width) params.w = data.width;
			if (data.height) params.h = data.height;
			if (data.scaleWidth) params.screenScaleX = data.scaleWidth;
			if (data.scaleHeight) params.screenScaleY = data.scaleHeight;
			RobloxWindow.setWindow(params);
			break;
		case 'SetWindowDefault':
			// Exit fullscreen and maximize window
			RobloxWindow.setFullscreen(false).then(() => {
				sleep(500).then(() => {
					RobloxWindow.maximize();
				});
			});
			break;
		case 'RestoreWindow':
		case 'RestoreWindowState':
		case 'ResetWindow':
			RobloxWindow.reset();
			break;
		case 'SaveWindowState':
			RobloxWindow.saveState();
			break;
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
