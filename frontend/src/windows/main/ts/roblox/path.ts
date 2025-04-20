// Get the most recent opened roblox path
import { os } from '@neutralinojs/lib';
import path from 'path-browserify';
import shellFS from '../tools/shellfs';

export async function getMostRecentRoblox(): Promise<string> {
	const knownPaths = ['/Applications/Roblox.app/', path.join(await os.getEnv('HOME'), 'Applications/Roblox.app/')];
	let mostRecentPath = '';
	let date = 0;
	for (const path of knownPaths) {
		const info = await shellFS.getInfo(path);
		if (!info) continue;
		const lastOpened = info.modTime;
		if (Number.parseInt(lastOpened) === Math.max(date, Number.parseInt(lastOpened))) {
			date = Math.max(date, Number.parseInt(lastOpened));
			mostRecentPath = info.name;
		}
	}
	console.info(`[Roblox.Path] Most recently opened Roblox app is at: "${mostRecentPath}"`);
	return mostRecentPath;
}