import { computer } from '@neutralinojs/lib';
import Roblox from '.';
import { getValue } from '../../components/settings';
import { Notification } from '../tools/notifications';
import { RPCController, type RPCOptions } from '../tools/rpc';
import { shell } from '../tools/shell';
import { curlGet, sleep } from '../utils';
import type { GameEventInfo } from './instance';

interface RobloxGame {
	id: number;
	rootPlaceId: number;
	name: string;
	description: string;
	sourceName: string;
	sourceDescription: string;
	creator: RobloxCreator;
	price: any;
	allowedGearGenres: string[];
	allowedGearCategories: any[];
	isGenreEnforced: boolean;
	copyingAllowed: boolean;
	playing: number;
	visits: number;
	maxPlayers: number;
	created: string;
	updated: string;
	studioAccessToApisAllowed: boolean;
	createVipServersAllowed: boolean;
	universeAvatarType: string;
	genre: string;
	isAllGenre: boolean;
	isFavoritedByUser: boolean;
	favoritedCount: number;
}

interface RobloxCreator {
	id: number;
	name: string;
	type: string;
	isRNVAccount: boolean;
	hasVerifiedBadge: boolean;
}

interface GameImageRes {
	targetId: number;
	state: string;
	imageUrl: string;
	version: string;
}

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

let rpcOptions: RPCOptions = {
	clientId: '1257650541677383721',
	smallImage: 'appleblox',
	smallImageText: 'Playing with AppleBlox',
};

export default async function onGameEvent(data: GameEventInfo) {
	try {
		switch (data.event) {
			case 'GameJoiningEntry': {
				// Resolution fix for mods
				if ((await getValue('mods.general.fix_res')) === true) {
					const maxRes = (
						await shell("system_profiler SPDisplaysDataType | grep Resolution | awk -F': ' '{print $2}'", [], {
							completeCommand: true,
						})
					).stdOut
						.trim()
						.split(' ');
					await Roblox.Window.setDesktopRes(maxRes[0], maxRes[2], 6);
				}

				const placeMatch = data.data.match(/place\s+(\d+)\s+/);
				if (!placeMatch) {
					console.error("[Activity] Couldn't retrieve the placeId from the logs");
					return;
				}
				const jobMatch = data.data.match(
					/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g
				);
				if (!jobMatch) {
					console.error("[Activity] Couldn't retrieve the jobID");
				}

				// Fetch the universeId and gameInfo, then init the DiscordRPC
				const placeId = placeMatch[1];
				const jobId = jobMatch ? jobMatch[0] : null;

				const universeIdReq = await curlGet(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
				const universeId = universeIdReq.universeId;
				console.info(`[Activity] Joining PlaceID: ${placeId}, UniverseID: ${universeId}, JobID: ${jobId}`);

				const gameInfoReq = await curlGet(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
				const gameInfo: RobloxGame = gameInfoReq.data[0];
				console.info('[Activity] Game Info:', gameInfo);

				const gameImageReq = await curlGet(
					`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`
				);
				console.info('[Activity] Game Image: ', gameImageReq);
				const gameImage: GameImageRes = gameImageReq.data[0];

				const joinLink = `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${jobId}`;

				rpcOptions = {
					...rpcOptions,
					details: `Playing ${gameInfo.name}`,
					state: `by ${gameInfo.creator.name}`,
					buttonText1: 'See game page',
					buttonUrl1: `https://www.roblox.com/games/${placeId}/`,
					largeImage: gameImage.imageUrl,
					largeImageText: gameInfo.name,
					enableTime: ((await getValue('integrations.rpc.time')) as boolean | undefined) || false,
				};

				if (jobId && (await getValue('integrations.rpc.joining')) === true) {
					rpcOptions = {
						...rpcOptions,
						buttonText2: 'Join server',
						buttonUrl2: `"${joinLink}"`,
					};
				} else {
					rpcOptions.buttonText2 = undefined;
					rpcOptions.buttonUrl2 = undefined;
				}

				await RPCController.set(rpcOptions);
				break;
			}
			case 'GameDisconnected':
			case 'GameLeaving':
				RPCController.preset('inRobloxApp');
				console.info(`[Activity] ${data.event === 'GameDisconnected' ? 'Disconnected from game' : 'Leaving game'}`);
				break;
			case 'GameJoinedEntry': {
				// Add the join server button
				const server = data.data.substring(10).split('|');
				console.info(`[Activity] Current server: ${server[0]}, Port: ${server[1]}`);
				if ((await getValue('integrations.activity.notify_location')) === true) {
					const ipReq: IPResponse = await curlGet(`https://ipinfo.io/${server[0]}/json`);
					console.info(`[Activity] Server is located in "${ipReq.city}"`);

					new Notification({
						content: `Your server is located in ${ipReq.city}, ${ipReq.region}, ${ipReq.country}`,
						title: 'Server Joined',
						timeout: 5,
						sound: false,
					}).show();
				}
				break;
			}
			case 'GameMessageEntry':
				if (!(await getValue('integrations.sdk.enabled'))) return;
				try {
					const json = data.data.match(/\{.*\}/);
					if (!json) {
						console.error("[Activity] Couldn't retrieve GameMessage json");
						return;
					}
					const message = JSON.parse(json[0]);
					const { data: messageData, command } = message;
					switch (command) {
						case 'SetRichPresence': {
							if (!(await getValue('integrations.sdk.rpc'))) return;
							const options: RPCOptions = {
								clientId: '1257650541677383721',
								enableTime: ((await getValue('integrations.rpc.time')) as boolean | undefined) || false,
							};
							if (messageData.details) options.details = messageData.details;
							if (messageData.state) options.state = messageData.state;
							if (messageData.smallImage) {
								if (messageData.smallImage.hoverText) options.smallImageText = messageData.smallImage.hoverText;
								options.smallImage = `https://assetdelivery.roblox.com/v1/asset/?id=${messageData.smallImage.assetId}`;
							}
							if (messageData.largeImage) {
								if (messageData.largeImage.hoverText) options.largeImage = messageData.largeImage.hoverText;
								options.largeImage = `https://assetdelivery.roblox.com/v1/asset/?id=${messageData.largeImage.assetId}`;
							}
							RPCController.set(options);
							break;
						}
						case 'SetWindow':
							if (!(await getValue('integrations.sdk.window'))) return;
							try {
								const screenSize = (await computer.getDisplays())[0].resolution;
								if (messageData.reset) {
									Roblox.Window.maximize();
									return;
								}
								if (messageData.x && messageData.y) {
									await Roblox.Window.move(messageData.x, messageData.y);
								}
								if (messageData.width && messageData.height) {
									let scaling = {
										width: 1,
										height: 1,
									};
									if (messageData.scaleWidth && messageData.scaleHeight) {
										scaling = {
											width: screenSize.width / messageData.scaleWidth,
											height: screenSize.height / messageData.scaleHeight,
										};
									}
									Roblox.Window.resize(messageData.width * scaling.width, messageData.height * scaling.height);
									break;
								}
								break;
							} catch (err) {
								console.error(err);
							}
							break;
						case 'RestoreWindow':
							Roblox.Window.maximize();
							break;
						case 'SetWindowDefault':
							Roblox.Window.setFullscreen(false);
							await sleep(500);
							Roblox.Window.maximize();
							break;
					}
				} catch (err) {
					console.error(err);
				}
		}
	} catch (err) {
		console.error(err);
	}
}
