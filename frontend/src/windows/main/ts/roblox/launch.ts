import { hasRoblox, parseFFlags } from "./utils";
import { pathExists, curlGet } from "../utils";
import shellFS from "../shellfs";
import { GameEventInfo, RobloxInstance } from "./instance";
import { DiscordRPC, RPCOptions } from "../rpc";
import { os } from "@neutralinojs/lib";
import { loadSettings } from "../settings";
import { toast } from "svelte-sonner";
import { sleep } from "$lib/appleblox";
import { showNotification } from "../notifications";
import { getRobloxPath } from "./path";
import path from "path-browserify";

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

let rpc: DiscordRPC | null = null;
let rpcOptions: RPCOptions = {
	clientId: "1257650541677383721",
	smallImage: "appleblox",
	smallImageText: "Playing with AppleBlox",
};

let rbxInstance: RobloxInstance | null = null;

async function onGameEvent(data: GameEventInfo) {
	const settings = await loadSettings("integrations").catch(console.error);
	try {
		switch (data.event) {
			case "GameJoiningEntry":
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
				console.log("Game Info:", gameInfo);

				const gameImageReq = await curlGet(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`);
				console.log("Game Image: ", gameImageReq);
				const gameImage: GameImageRes = gameImageReq.data[0];

				rpcOptions = {
					...rpcOptions,
					details: `Playing ${gameInfo.name}`,
					state: `by ${gameInfo.creator.name}`,
					buttonText1: "See game page",
					buttonUrl1: `https://www.roblox.com/games/${placeId}/`,
					largeImage: gameImage.imageUrl,
					largeImageText: gameInfo.name,
					enableTime: settings ? settings.rpc.rpc_time : true,
				};

				if (jobId && settings && settings.rpc.rpc_join) {
					rpcOptions = {
						...rpcOptions,
						buttonText2: "Join server",
						buttonUrl2: `"https://rpcdeeplinks.netlify.app?url=roblox://experiences/start?placeId=${placeId}&gameInstanceId=${jobId}"`,
					};
				} else {
					delete rpcOptions.buttonText2;
					delete rpcOptions.buttonUrl2;
				}

				if (rpc) {
					await rpc.update(rpcOptions);
					console.log("Updated Roblox Game RPC");
				} else {
					rpc = new DiscordRPC();
					await rpc.start(rpcOptions);
					console.log("Started Roblox Game RPC");
				}
				break;
			case "GameDisconnected":
			case "GameLeaving":
				const normalRpcOptions = {
					clientId: "1257650541677383721",
					details: "Currently in the launcher",
					state: "using AppleBlox",
					largeImage: "appleblox",
					largeImageText: "AppleBlox Logo",
					enableTime: true,
				};
				if (rpc) {
					await rpc.update(normalRpcOptions);
				} else {
					rpc = new DiscordRPC();
					await rpc.start(normalRpcOptions);
				}
				console.log("Disconnected/Left game");
				break;
			case "GameJoinedEntry":
				// Add the join server button
				const server = data.data.substring(10).split("|");
				console.log(`Current server: ${server[0]}, Port: ${server[1]}`);
				if (settings && settings.activity.notify_location) {
					const ipReq: IPResponse = await curlGet(`https://ipinfo.io/${server[0]}/json`);
					console.log(`Server is located in "${ipReq.city}"`);
					showNotification({
						content: `Your server is located in ${ipReq.city}, ${ipReq.region}, ${ipReq.country}`,
						title: "Server Joined",
						timeout: 5,
						sound: false,
					});
				}
				break;
			case "GameMessageEntry":
				if (settings && !settings.activity.bloxstrap_sdk) return;
				try {
					const json = data.data.match(/\{.*\}/);
					if (!json) {
						console.error("Couldn't retrieve GameMessage json");
						return;
					}
					const message = JSON.parse(json[0]);
					const { data: inst, command } = message;
					switch (command) {
						case "SetRichPresence":
							let options: RPCOptions = { clientId: "1257650541677383721", enableTime: settings ? settings.rpc.rpc_time : true };
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
							console.log("GameMessageEntry RPC:", options);
							if (rpc) {
								await rpc.update(options);
							} else {
								rpc = new DiscordRPC();
								rpcOptions = options;
								await rpc.start(options);
							}
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
	setLaunchText: (value: string) => void
) {
	if (rbxInstance || (await os.execCommand('pgrep -f "Roblox"')).stdOut.trim().length > 2) {
		setLaunchText("Roblox is already open");
		setLaunchingRoblox(false);
		toast.error("Due to technical reasons, you must close all instances of Roblox before launching from AppleBlox.");
		return;
	}
	// We use multiple functions as argument so things like launchProgress, the text to show in the UI, etc... can be read by App.svelte
	try {
		console.log("Launching Roblox");
		setLaunchingRoblox(true);
		if (!(await hasRoblox())) {
			console.log("Roblox is not installed. Exiting launch process.");
			setLaunchingRoblox(false);
			return;
		}

		const robloxPath = getRobloxPath();

		setLaunchProgress(20);
		if (await pathExists(path.join(robloxPath, "Contents/MacOS/ClientSettings/ClientAppSettings.json"))) {
			console.log(`Removing current ClientAppSettings.json file in ${path.join(robloxPath, "Contents/MacOS/ClientSettings/ClientAppSettings.json")}`);
			await shellFS.remove(path.join(robloxPath, "Contents/MacOS/ClientSettings/"));
			setLaunchText("Removing current ClientAppSettings...");
		}
		setLaunchProgress(40);
		setLaunchText("Copying fast flags...");
		console.log("Copying fast flags");
		await shellFS.createDirectory(path.join(robloxPath, "Contents/MacOS/ClientSettings"));
		console.log("Parsing saved FFlags");
		const fflags = { ...(await parseFFlags(false)), ...(await parseFFlags(true)) };
		console.log(fflags);
		await shellFS.writeFile(path.join(robloxPath, "Contents/MacOS/ClientSettings/ClientAppSettings.json"), JSON.stringify(fflags));
		console.log(`Wrote FFlags to ${path.join(robloxPath, "Contents/MacOS/ClientSettings/ClientAppSettings.json")}`);
		setLaunchProgress(60);
		setTimeout(async () => {
			try {
				const robloxInstance = new RobloxInstance(true);
				await robloxInstance.init();
				await robloxInstance.start();
				setRobloxConnected(true);
				rbxInstance = robloxInstance;
				robloxInstance.on("gameEvent", onGameEvent);
				robloxInstance.on("exit", () => {
					setRobloxConnected(false);
					rbxInstance = null;
					console.log("Roblox exited");
				});
			} catch (err) {
				console.error(err);
				setLaunchingRoblox(false);
				toast.error("An error occured while starting Roblox.");
				await shellFS.remove(path.join(robloxPath, "Contents/MacOS/ClientSettings/"));
				console.log(`Deleted ${path.join(robloxPath, "Contents/MacOS/ClientSettings/")}`);
				return;
			}

			setLaunchProgress(100);
			setLaunchText("Roblox Launched");
			setTimeout(() => {
				setLaunchingRoblox(false);
				shellFS.remove(path.join(robloxPath, "Contents/MacOS/ClientSettings/"));
				console.log(`Deleted ${path.join(robloxPath, "Contents/MacOS/ClientSettings")}`);
			}, 1000);
		}, 1000);
	} catch (err) {
		console.error("An error occured while launching Roblox");
		console.error(err);
		setLaunchingRoblox(false);
		setRobloxConnected(false);
	}
}
