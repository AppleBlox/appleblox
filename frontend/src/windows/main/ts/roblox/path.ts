import { os } from '@neutralinojs/lib';
import path from 'path-browserify';

let robloxPath: null | string = null;

async function getMostRecentRoblox() {
	const knownPaths = [
		'/Applications/Roblox.app',
		path.join(await os.getEnv('HOME'), 'Applications/Roblox.app'),
	];
	let mostRecentPath = '';
	let date = 0;
	for (const path of knownPaths) {
		const lastOpened = (await os.execCommand(`stat -f "%a" "${path}"`)).stdOut.trim();
		if (Number.parseInt(lastOpened) === Math.max(date, Number.parseInt(lastOpened))) {
			date = Math.max(date, Number.parseInt(lastOpened));
			mostRecentPath = path;
		}
	}
	robloxPath = mostRecentPath;
}

getMostRecentRoblox();

export function getRobloxPath() {
	return robloxPath ? robloxPath : '/Applications/Roblox.app';
}
