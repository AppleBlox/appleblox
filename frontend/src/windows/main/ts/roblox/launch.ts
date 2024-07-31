import { pathExists, curlGet } from '../utils';
import shellFS from '../shellfs';
import { GameEventInfo, RobloxInstance } from './instance';
import { RPCController, RPCOptions } from '../rpc';
import { computer, os } from '@neutralinojs/lib';
import { loadSettings } from '../settings';
import { toast } from 'svelte-sonner';
import { sleep } from '../utils';
import { showNotification } from '../notifications';
import { getRobloxPath } from './path';
import path from 'path-browserify';
import Roblox from '.';
import { focusWindow, setWindowVisibility } from '../window';

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

export interface IPResponse {
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
let rbxInstance: RobloxInstance | null = null;

async function onGameEvent(data: GameEventInfo) {
	const settings = await loadSettings('integrations').catch(console.error);
	const modSettings = await loadSettings('mods').catch(console.error);
	try {
		switch (data.event) {
			case 'GameJoiningEntry':
				// Change the resolution to support mods
				if (modSettings && modSettings.general.enable_mods) {
					const maxRes = (await os.execCommand(`system_profiler SPDisplaysDataType | grep Resolution | awk -F': ' '{print $2}'`)).stdOut.trim().split(' ');
					Roblox.Window.setDesktopRes(maxRes[0], maxRes[2], 6);
				}

				const placeMatch = data.data.match(/place\s+(\d+)\s+/);
				if (!placeMatch) {
					console.error("Couldn't retrieve the placeId from the logs");
					return;
				}
				const jobMatch = data.data.match(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g);
				if (!jobMatch) {
					console.error("Couldn't retrieve the jobID");
				}

				// Fetch the universeId and gameInfo, then init the DiscordRPC
				const placeId = placeMatch[1];
				const jobId = jobMatch ? jobMatch[0] : null;

				const universeIdReq = await curlGet(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
				const universeId = universeIdReq.universeId;
				console.log(`Joining PlaceID: ${placeId}, UniverseID: ${universeId}, JobID: ${jobId}`);

				const gameInfoReq = await curlGet(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
				const gameInfo: RobloxGame = gameInfoReq.data[0];
				console.log('Game Info:', gameInfo);

				const gameImageReq = await curlGet(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`);
				console.log('Game Image: ', gameImageReq);
				const gameImage: GameImageRes = gameImageReq.data[0];

				if (settings && settings.rpc.enable_rpc) {
					rpcOptions = {
						...rpcOptions,
						details: `Playing ${gameInfo.name}`,
						state: `by ${gameInfo.creator.name}`,
						buttonText1: 'See game page',
						buttonUrl1: `https://www.roblox.com/games/${placeId}/`,
						largeImage: gameImage.imageUrl,
						largeImageText: gameInfo.name,
						enableTime: settings ? settings.rpc.rpc_time : true,
					};

					if (jobId && settings && settings.rpc.rpc_join) {
						rpcOptions = {
							...rpcOptions,
							buttonText2: 'Join server',
							buttonUrl2: `"roblox://experiences/start?placeId=${placeId}&gameInstanceId=${jobId}"`,
						};
					} else {
						delete rpcOptions.buttonText2;
						delete rpcOptions.buttonUrl2;
					}

					await RPCController.set(rpcOptions);
					console.log('Message Roblox Game RPC');
				}
				break;
			case 'GameDisconnected':
			case 'GameLeaving':
				if (settings && settings.rpc.enable_rpc) {
					RPCController.preset('inRobloxApp');
				}
				console.log('Disconnected/Left game');
				break;
			case 'GameJoinedEntry':
				// Add the join server button
				const server = data.data.substring(10).split('|');
				console.log(`Current server: ${server[0]}, Port: ${server[1]}`);
				if (settings && settings.activity.notify_location) {
					const ipReq: IPResponse = await curlGet(`https://ipinfo.io/${server[0]}/json`);
					console.log(`Server is located in "${ipReq.city}"`);
					showNotification({
						content: `Your server is located in ${ipReq.city}, ${ipReq.region}, ${ipReq.country}`,
						title: 'Server Joined',
						timeout: 5,
						sound: false,
					});
				}
				break;
			case 'GameMessageEntry':
				if (settings && !settings.sdk.enabled) return;
				try {
					const json = data.data.match(/\{.*\}/);
					if (!json) {
						console.error("Couldn't retrieve GameMessage json");
						return;
					}
					const message = JSON.parse(json[0]);
					const { data: inst, command } = message;
					switch (command) {
						case 'SetRichPresence':
							if (settings && !settings.sdk.sdk_rpc) return;
							let options: RPCOptions = { clientId: '1257650541677383721', enableTime: settings ? settings.rpc.rpc_time : true };
							if (inst.details) options.details = inst.details;
							if (inst.state) options.state = inst.state;
							if (inst.smallImage) {
								if (inst.smallImage.hoverText) options.smallImageText = inst.smallImage.hoverText;
								options.smallImage = `https://assetdelivery.roblox.com/v1/asset/?id=${inst.smallImage.assetId}`;
							}
							if (inst.largeImage) {
								if (inst.largeImage.hoverText) options.largeImage = inst.largeImage.hoverText;
								options.largeImage = `https://assetdelivery.roblox.com/v1/asset/?id=${inst.largeImage.assetId}`;
							}
							console.log('GameMessageEntry RPC:', options);
							RPCController.set(options);
							break;
						case 'SetWindow':
							if (settings && !settings.sdk.window) return;
							try {
								const screenSize = (await computer.getDisplays())[0].resolution;
								if (inst.reset) {
									Roblox.Window.maximize();
									return;
								}
								if (inst.x && inst.y) {
									await Roblox.Window.move(inst.x, inst.y);
								}
								if (inst.width && inst.height) {
									let scaling = {
										width: 1,
										height: 1,
									};
									if (inst.scaleWidth && inst.scaleHeight) {
										scaling = {
											width: screenSize.width / inst.scaleWidth,
											height: screenSize.height / inst.scaleHeight,
										};
									}
									Roblox.Window.resize(inst.width * scaling.width, inst.height * scaling.height);
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

/** Launches a Roblox instance */
export async function launchRoblox(
	setRobloxConnected: (value: boolean) => void,
	setLaunchingRoblox: (value: boolean) => void,
	setLaunchProgress: (value: number) => void,
	setLaunchText: (value: string) => void,
	robloxUrl?: string
) {
	if (rbxInstance || (await os.execCommand('pgrep -f "RobloxPlayer"')).stdOut.trim().length > 2) {
		setLaunchText('Roblox is already open');
		setLaunchingRoblox(false);
		toast.error('Due to technical reasons, you must close all instances of Roblox before launching from AppleBlox.');
		return;
	}
	// We use multiple functions as argument so things like launchProgress, the text to show in the UI, etc... can be read by App.svelte
	try {
		console.log('Launching Roblox');
		setLaunchingRoblox(true);
		if (!(await Roblox.Utils.hasRoblox())) {
			console.log('Roblox is not installed. Exiting launch process.');
			setLaunchingRoblox(false);
			return;
		}

		const modSettings = await loadSettings('mods');
		if (modSettings) {
			if (modSettings.general.enable_mods) {
				setLaunchProgress(20);
				setLaunchText('Copying Mods...');

				await Roblox.Mods.copyToFiles();
			}
			await Roblox.Mods.applyCustomFont(modSettings);
		}

		const robloxPath = getRobloxPath();

		setLaunchProgress(30);
		if (await pathExists(path.join(robloxPath, 'Contents/MacOS/ClientSettings/ClientAppSettings.json'))) {
			console.log(`Removing current ClientAppSettings.json file in ${path.join(robloxPath, 'Contents/MacOS/ClientSettings/ClientAppSettings.json')}`);
			await shellFS.remove(path.join(robloxPath, 'Contents/MacOS/ClientSettings/'));
			setLaunchText('Removing current ClientAppSettings...');
		}

		setLaunchProgress(40);
		setLaunchText('Copying fast flags...');
		console.log('Copying fast flags');
		await shellFS.createDirectory(path.join(robloxPath, 'Contents/MacOS/ClientSettings'));
		console.log('Parsing saved FFlags');
		const fflags = { ...(await Roblox.FFlags.parseFlags(false)), ...(await Roblox.FFlags.parseFlags(true)) };
		console.log(fflags);
		await shellFS.writeFile(path.join(robloxPath, 'Contents/MacOS/ClientSettings/ClientAppSettings.json'), JSON.stringify(fflags));
		console.log(`Wrote FFlags to ${path.join(robloxPath, 'Contents/MacOS/ClientSettings/ClientAppSettings.json')}`);
		setLaunchProgress(60);
		setTimeout(async () => {
			try {
				if (modSettings && modSettings.general.spoof_res) {
					const maxRes = (await os.execCommand(`system_profiler SPDisplaysDataType | grep Resolution | awk -F': ' '{print $2}'`)).stdOut.trim().split(' ');
					Roblox.Window.setDesktopRes(maxRes[0], maxRes[2], 5);
					showNotification({
						title: 'Resolution changed',
						content: "Your resolution was temporarily changed (5s) by the 'Fix Resolution' setting.",
						timeout: 10,
					});
				}
				const robloxInstance = new RobloxInstance(true);
				await robloxInstance.init();
				await robloxInstance.start(robloxUrl);
				setRobloxConnected(true);
				rbxInstance = robloxInstance;

				const integrationsSettings = await loadSettings('integrations');
				if (integrationsSettings && integrationsSettings.rpc.enable_rpc) {
					RPCController.preset('inRobloxApp');
				}

				robloxInstance.on('gameEvent', onGameEvent);
				robloxInstance.on('exit', async () => {
					if (modSettings) {
						if (modSettings.general.enable_mods) {
							await Roblox.Mods.restoreRobloxFolders()
								.catch(console.error)
								.then(() => {
									console.log(`Removed mod files from "${path.join(robloxPath, 'Contents/Resources/')}"`);
								});
						}
						await Roblox.Mods.removeCustomFont(modSettings);
					}
					RPCController.stop();
					setWindowVisibility(true);
					focusWindow();
					setRobloxConnected(false);
					rbxInstance = null;
					console.log('Roblox exited');
				});
			} catch (err) {
				if (modSettings && modSettings.general.enable_mods) {
					await Roblox.Mods.restoreRobloxFolders()
						.catch(console.error)
						.then(() => {
							console.log(`Removed mod files from "${path.join(robloxPath, 'Contents/Resources/')}"`);
						});
				}
				console.error(err);
				setLaunchingRoblox(false);
				toast.error('An error occured while starting Roblox.');
				await shellFS.remove(path.join(robloxPath, 'Contents/MacOS/ClientSettings/'));
				console.log(`Deleted ${path.join(robloxPath, 'Contents/MacOS/ClientSettings/')}`);
				return;
			}

			setLaunchProgress(100);
			setLaunchText('Roblox Launched');
			setWindowVisibility(false);
			setTimeout(() => {
				setLaunchingRoblox(false);
				shellFS.remove(path.join(robloxPath, 'Contents/MacOS/ClientSettings/'));
				console.log(`Deleted ${path.join(robloxPath, 'Contents/MacOS/ClientSettings')}`);
			}, 1000);
		}, 1000);
	} catch (err) {
		console.error('An error occured while launching Roblox');
		console.error(err);
		setLaunchingRoblox(false);
		setRobloxConnected(false);
	}
}
