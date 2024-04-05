import { getMode } from './env';
import { join } from "path-browserify";

// The library paths when in dev or production
const LibPaths = {
	notifications: {
		darwin: {
			// Starting in the lib folder
			prod: '/lib/alerter',
			dev: '/build/lib/MacOS/alerter',
		},
	}
} as const;

type LibPathsType = typeof LibPaths;

export function libraryPath<T extends keyof LibPathsType>(libName: T): LibPathsType[T] | null {
	if (!(libName in LibPaths)) return null;
    if (!(window.NL_OS.toLowerCase() in LibPaths[libName])) return null;
	// @ts-expect-error
	const path = LibPaths[libName][window.NL_OS.toLowerCase()];
	// @ts-expect-error
	return join(window.NL_PATH, getMode() === 'dev' ? path.dev : path.prod);
}

export default LibPaths;