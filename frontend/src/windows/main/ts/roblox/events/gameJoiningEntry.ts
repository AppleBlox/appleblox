import { getValue } from "@/windows/main/components/settings";
import { shell } from "../../tools/shell";
import Roblox from "..";
import type { GameEventInfo } from "../instance";
import { curlGet } from "../../utils";
import { RPCController, type RPCOptions } from "../../tools/rpc";

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

let rpcOptions: RPCOptions = {
	clientId: '1257650541677383721',
	smallImage: 'appleblox',
	smallImageText: 'Playing with AppleBlox',
};

async function gameJoiningEntry(data: GameEventInfo) {
    // Resolution fix for Mods using a Retina screen
	if ((await getValue<boolean>('mods.general.fix_res')) === true) {
		const maxRes = (
            // Get max possible resolution
			await shell("system_profiler SPDisplaysDataType | grep Resolution | awk -F': ' '{print $2}'", [], {
				completeCommand: true,
			})
		).stdOut
			.trim()
			.split(' ');
		await Roblox.Window.setDesktopRes(maxRes[0], maxRes[2], 6);
	}

    // Fetch game information using the Roblox API
	const placeMatch = data.data.match(/place\s+(\d+)\s+/); // placeID
	if (placeMatch == null) {
		console.error(`[Activity] Couldn't retrieve the placeId from the logs: ${data.data}`);
		return;
	}
	const jobMatch = data.data.match(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g); // jobID (current server ID)
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

	if (jobId && (await getValue<boolean>('integrations.rpc.joining')) === true) {
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
}

export default gameJoiningEntry;
