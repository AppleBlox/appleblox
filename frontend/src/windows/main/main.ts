// Init imports
import './app.css';
import './ts/debugging';
import './ts/roblox';
import './ts/window';

// Imports
import { events, init, app as neuApp, window as neuWindow } from '@neutralinojs/lib';
import { version } from '../../../../package.json';
import App from './App.svelte';
import { RPCController } from './ts/tools/rpc';
import { shell } from './ts/tools/shell';
import { focusWindow } from './ts/window';
import { getMode } from './ts/utils';
import { logDebugInfo } from './ts/utils/debug';

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
	neuWindow.show();
	if (getMode() === 'prod') focusWindow();
	setTimeout(async () => {
		logDebugInfo();
	}, 500);
});

// Cleanup when the application is closing
events.on('windowClose', quit);
events.on('exitApp', quit);

const app = new App({
	// @ts-expect-error
	target: document.getElementById('app'),
});

export default app;
