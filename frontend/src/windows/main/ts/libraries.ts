import { join } from 'path-browserify';
import { getMode } from './utils';

type OS = 'darwin' | 'linux' | 'windows';
type LibPathsType = {
	[key: string]: Partial<{
		[key in OS]: {
			prod: string;
			dev: string;
		};
	}>;
};

const LibPaths: LibPathsType = {
	notifications: {
		darwin: {
			prod: '/lib/alerter_ablox',
			dev: '/bin/alerter_ablox',
		},
	},
	discordrpc: {
		darwin: {
			prod: '/lib/discordrpc_ablox',
			dev: '/bin/discordrpc_ablox',
		},
	},
	urlscheme: {
		darwin: {
			prod: '/lib/urlscheme_ablox',
			dev: '/bin/urlscheme_ablox',
		},
	},
	transparent_viewer: {
		darwin: {
			prod: '/lib/transparent_viewer_ablox',
			dev: '/bin/transparent_viewer_ablox',
		},
	},
	roblox_updates_manager: {
		darwin: {
			prod: '/lib/roblox_updater_manager_ablox.sh',
			dev: '/bin/roblox_updater_manager_ablox.sh',
		},
	},
};

export function libraryPath<T extends keyof LibPathsType>(libName: T): string {
	if (!(libName in LibPaths)) throw Error(`Library "${libName}" doesn't exist.`);
	const os = window.NL_OS.toLowerCase() as OS;
	if (!(os in LibPaths[libName])) throw Error(`Library "${libName}" doesn't support OS "${os}".`);

	const mode = getMode();

	const pathsForOs = LibPaths[libName][os];
	if (!pathsForOs) throw Error(`Library "${libName}" has no paths defined for OS "${os}".`);

	const path = pathsForOs[mode];
	if (!path) throw Error(`Library "${libName}" has no path defined for mode "${mode}" on OS "${os}".`);

	return join(window.NL_PATH, path);
}

export default LibPaths;
