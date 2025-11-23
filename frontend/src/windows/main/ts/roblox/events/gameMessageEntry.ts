import { getValue } from '@/windows/main/components/settings';
import { RPCController, type RPCOptions } from '../../tools/rpc';
import type { GameEventInfo } from '../instance';
import type { RichPresence, ThumbnailApiResponse } from './types';
import Logger from '@/windows/main/ts/utils/logger';
import { Curl } from '../../tools/curl';

let rpcOptions: RPCOptions = {
	clientId: '1257650541677383721',
};

type GameMessage = string | { data: RichPresence; command: 'SetRichPresence' };

async function fetchThumbnail(assetId: number): Promise<string | null> {
	if (!assetId || assetId <= 0) {
		Logger.error(`Invalid assetId: ${assetId}`);
		return null;
	}

	try {
		const url = `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&returnPolicy=PlaceHolder&size=30x30&format=png&isCircular=false`;
		console.debug(url)
		const response = await Curl.get(url);

		if (!response.body) {
			Logger.error('Thumbnails API returned no body');
			return null;
		}

		const jsonBody: ThumbnailApiResponse = JSON.parse(response.body);

		if (!jsonBody.data || jsonBody.data.length === 0) {
			Logger.error('Thumbnails API returned empty data array');
			return null;
		}

		const thumbnail = jsonBody.data[0];

		if (!thumbnail.imageUrl) {
			Logger.error('Thumbnails API returned no imageUrl');
			return null;
		}

		return thumbnail.imageUrl.replace("30/30","1024/1024");
	} catch (err) {
		Logger.error('Failed to fetch thumbnail:', err);
		return null;
	}
}

async function gameMessageEntry(messageData: GameEventInfo) {
	try {
		const sdkEnabled = await getValue<boolean>('integrations.sdk.enabled');
		if (sdkEnabled !== true) return;

		if (!messageData?.data) {
			Logger.error('Invalid messageData received');
			return;
		}

		const jsonMatch = messageData.data.match(/\{.*\}/);
		if (!jsonMatch) {
			Logger.error("Couldn't extract JSON from GameMessage");
			return;
		}

		let message: GameMessage;
		try {
			message = JSON.parse(jsonMatch[0]);
		} catch (err) {
			Logger.error('Failed to parse GameMessage JSON:', err);
			return;
		}

		if (typeof message === 'string') return;

		const { data, command } = message;

		switch (command) {
			case 'SetRichPresence': {
				const rpcEnabled = await getValue<boolean>('integrations.sdk.rpc');
				if (rpcEnabled !== true) return;

				if (!data) {
					Logger.error('SetRichPresence command missing data');
					return;
				}

				rpcOptions = {
					...rpcOptions,
					enableTime: data.timeStart != null,
					details: data.details,
					state: data.state,
				};

				if (data.smallImage?.assetId) {
					const imageUrl = await fetchThumbnail(data.smallImage.assetId);
					if (imageUrl) {
						rpcOptions.smallImage = imageUrl;
						if (data.smallImage.hoverText) {
							rpcOptions.smallImageText = data.smallImage.hoverText;
						}
					}
				}

				if (data.largeImage?.assetId) {
					const imageUrl = await fetchThumbnail(data.largeImage.assetId);
					if (imageUrl) {
						rpcOptions.largeImage = imageUrl;
						if (data.largeImage.hoverText) {
							rpcOptions.largeImageText = data.largeImage.hoverText;
						}
					}
				}

				RPCController.set(rpcOptions);
				break;
			}
			default:
				Logger.warn(`Unknown command: ${command}`);
		}
	} catch (err) {
		Logger.error('Failed to process game message:', err);
	}
}

export default gameMessageEntry;
