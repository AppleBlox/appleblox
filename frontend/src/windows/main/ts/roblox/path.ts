import { shell } from '../tools/shell';
import Logger from '@/windows/main/ts/utils/logger';

export async function getMostRecentRoblox(): Promise<string> {
	let mostRecentPath = '';
	const mdfindPath = await shell(
		`find /Applications "$HOME/Applications" -maxdepth 1 -iname '*roblox*.app' -exec stat -f '%a %N' {} + 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-`,
		[],
		{
			completeCommand: true,
			skipStderrCheck: true,
		}
	);
	mostRecentPath = mdfindPath.stdOut.includes('/Roblox.app') ? mdfindPath.stdOut.trim() : '/Applications/Roblox.app';
	Logger.info(`Most recently opened Roblox app is at: "${mostRecentPath}"`);
	return mostRecentPath;
}
