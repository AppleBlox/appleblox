// Used to import external binaries used in dev or production mode

import { join } from 'path-browserify';
import { getMode } from './utils';

// The library paths when in dev or production
const LibPaths = {
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
	watchdog: {
		darwin: {
			prod: '/lib/watchdog',
			dev: '/bin/watchdog',
		},
	},
	window_manager: {
		darwin: {
			prod: '/lib/window_manager',
			dev: '/bin/window_manager',
		},
	},
	urlscheme: {
		darwin: {
			prod: '/lib/urlscheme',
			dev: '/bin/urlscheme',
		},
	},
} as const;

type LibPathsType = typeof LibPaths;

export function libraryPath<T extends keyof LibPathsType>(libName: T): LibPathsType[T] | null {
	if (!(libName in LibPaths)) return null;
	// @ts-ignore
	if (!(window.NL_OS.toLowerCase() in LibPaths[libName])) return null;
	// @ts-expect-error
	const path = LibPaths[libName][window.NL_OS.toLowerCase()];
	// @ts-expect-error
	return join(window.NL_PATH, getMode() === 'dev' ? path.dev : path.prod);
}

export default LibPaths;
