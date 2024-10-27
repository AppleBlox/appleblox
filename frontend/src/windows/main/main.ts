// Init imports
import './app.css';
import './ts/debugging';
import './ts/roblox';
import './ts/window';

// Imports
import { computer, events, init, app as neuApp, window as neuWindow, os } from '@neutralinojs/lib';
import { loadTheme } from './components/theme-input/theme';
import App from './App.svelte';
import { RPCController } from './ts/tools/rpc';
import { shell } from './ts/tools/shell';
import { focusWindow } from './ts/window';
import { getMode } from './ts/utils';
import { logDebugInfo } from './ts/utils/debug';
import semverCompare from 'semver-compare';

// Initialize NeutralinoJS
init();

async function quit() {
	console.info('[Main] Exiting app');
	await RPCController.stop();
	await shell('pkill', ['-f', '_ablox'], { skipStderrCheck: true });
	await neuApp.exit();
}

// When NeutralinoJS is ready:
events.on('ready', async () => {
	// Load CSS Theme
	await loadTheme();
	// Show the window
	neuWindow.show();
	if (getMode() === 'prod') focusWindow();
	// Log debug information
	setTimeout(async () => {
		logDebugInfo();
	}, 500);
	// Show warning if using MacOS -11
	const version = (await computer.getOSInfo()).version;
	const isElevenOrMore = (await semverCompare(version.split('-')[0], '11.0.0')) >= 0;
	if (!isElevenOrMore) {
		console.log(os)
		os.showMessageBox(
			'Incompatible MacOS Version',
			"Due to specific limitations in AppleBlox's code, we cannot support older versions (>11) at this time. If the app is blank and doesn't load, please don't report this issue.",
			"OK" as os.MessageBoxChoice,
			"WARNING" as os.Icon.WARNING
		);
	}
});

// Cleanup when the application is closing
events.on('windowClose', quit);
events.on('exitApp', quit);

const app = new App({
	// @ts-expect-error
	target: document.getElementById('app'),
});

export default app;
