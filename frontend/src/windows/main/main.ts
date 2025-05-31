// Init imports
import '@/theme.css';
import './app.css';
import './ts/debugging';
import './ts/roblox';
import './ts/window';

// Imports
import { events, init, app as neuApp, window as neuWindow } from '@neutralinojs/lib';
import App from './App.svelte';
import { loadTheme } from './components/theme-input/theme';
import { RPCController } from './ts/tools/rpc';
import { shell } from './ts/tools/shell';
import { getMode } from './ts/utils';
import { logDebugInfo } from './ts/utils/debug';
import { focusWindow } from './ts/window';

// Initialize NeutralinoJS
init();

async function quit() {
	console.info('[Main] Exiting app');
	await RPCController.stop();
	await shell('pkill', ['-f', '_ablox'], { skipStderrCheck: true });
	// Send quit event if in browser mode
	if (window.NL_ARGS.includes('--mode=browser')) {
		neuApp.writeProcessOutput('quit');
	}
	await neuApp.exit();
}

// When NeutralinoJS is ready:
events.on('ready', async () => {
	// Load CSS Theme
	await loadTheme();
	// Show the window
	const deeplinkArg = window.NL_ARGS.find((arg) => arg.includes('--deeplink='));
	if (!deeplinkArg) {
		await neuWindow.show();
	}
	if (getMode() === 'prod' && !deeplinkArg) focusWindow();
	// Log debug information
	setTimeout(async () => {
		console.info(`Running at http://localhost:${window.NL_PORT}`);
		logDebugInfo();
	}, 500);
});

// Cleanup when the application is closing
events.on('windowClose', quit);
events.on('exitApp', quit);

// Check if app is in browser mode and add tab close event
if (window.NL_ARGS.includes('--mode=browser')) {
	window.addEventListener('beforeunload', () => {
		quit();
	});
}

const app = new App({
	// @ts-expect-error
	target: document.getElementById('app'),
});

export default app;
