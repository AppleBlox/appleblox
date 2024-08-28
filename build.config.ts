import { resolve as path } from 'node:path';
import type { Config } from './scripts/build/ts/config-types';

const BuildConfig: Config = {
	devPort: 5174,
	projectPath: path('./frontend/dist'),
	outDir: path('./dist'),
	appName: 'AppleBlox',
	description: 'A MacOS Roblox Launcher',
	appBundleName: 'AppleBlox',
	mac: {
		architecture: ['universal', 'arm64', 'x64'],
		appIcon: path('./build/assets/mac.icns'),
		minimumOS: '10.13.0',
	},
	// May sometimes test some things
	// win: {
	//     architecture: ["x64"],
	//     appIcon: path("./frontend/src/assets/favicon.png"),
	//     embedResources: false
	// }
};

export default BuildConfig;
