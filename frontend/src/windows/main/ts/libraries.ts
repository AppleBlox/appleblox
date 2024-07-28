// Used to import external binaries used in dev or production mode

import { getMode } from './utils';
import { join } from "path-browserify";

// The library paths when in dev or production
const LibPaths = {
	notifications: {
		darwin: {
			prod: '/lib/alerter_ablox',
			dev: '/build/lib/MacOS/alerter_ablox',
		},
	},
	discordrpc: {
		darwin: {
			prod: '/lib/discordrpc_ablox',
			dev: '/build/lib/MacOS/discordrpc_ablox',
		},
	},
	watchdog: {
		darwin: {
			prod: "/lib/watchdog",
			dev: "/build/lib/MacOS/watchdog"
		}
	},
	window_manager: {
		darwin: {
			prod: "/lib/window_manager",
			dev: "/build/lib/MacOS/window_manager"
		}
	},
	urlscheme: {
		darwin: {
			prod: "/lib/urlscheme",
			dev: "/build/lib/MacOS/urlscheme"
		}
	},
	urlhandler: {
		darwin: {
			prod: "/lib/AppleBloxUrlHandler.app",
			dev: "/build/lib/MacOS/AppleBloxUrlHandler.app"
		}
	}

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