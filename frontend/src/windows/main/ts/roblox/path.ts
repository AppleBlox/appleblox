// Get the most recent opened roblox path
import { os } from '@neutralinojs/lib';
import path from 'path-browserify';

export let robloxPath: string = '/Applications/Roblox.app';

async function getMostRecentRoblox() {
	const knownPaths = ['/Applications/Roblox.app', path.join(await os.getEnv('HOME'), 'Applications/Roblox.app')];
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
