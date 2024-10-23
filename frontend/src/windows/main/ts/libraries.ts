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

// The library paths when in dev or production
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
	window_manager: {
		darwin: {
			prod: '/lib/window_manager_ablox',
			dev: '/bin/window_manager_ablox',
		},
	},
	urlscheme: {
		darwin: {
			prod: '/lib/urlscheme_ablox',
			dev: '/bin/urlscheme_ablox',
		},
	}
};

export function libraryPath<T extends keyof LibPathsType>(libName: T): string {
	// Check if the library exists in the paths
	if (!(libName in LibPaths)) throw Error(`Library "${libName}" doesn't exist.`);

	// Get the OS and convert to lowercase
	const os = window.NL_OS.toLowerCase() as OS;

	// Check if the current OS is supported for the given library
	if (!(os in LibPaths[libName])) throw Error(`Library "${libName}" doesn't support OS "${os}".`);

	// Get the environment (dev or prod)
	const mode = getMode() === 'dev' ? 'dev' : 'prod';

	// Return the correct path based on OS and environment
	if (!LibPaths[libName][os]) throw Error(`Library "${libName}"'s value wasn't found.`);
	const path = LibPaths[libName][os][mode];
	return join(window.NL_PATH, path);
}

export default LibPaths;
