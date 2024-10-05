// Init imports
import './app.css';
import './ts/debugging';
import './ts/roblox';
import './ts/window';

// Imports
import { events, init, app as neuApp } from '@neutralinojs/lib';
import { version } from '../../../../package.json';
import App from './App.svelte';
import { RPCController } from './ts/tools/rpc';
import { shell } from './ts/tools/shell';
import { AbloxWatchdog } from './ts/watchdog';

// Initialize NeutralinoJS
init();

async function quit() {
	console.info('[Main] Exiting app');
	await RPCController.stop();
	await neuApp.exit();
}

// When NeutralinoJS is ready:
events.on('ready', async () => {
	setTimeout(async () => {
		console.info(`[Main] AppleBlox v${version}`);
		console.info(`[Main] Current Time: ${new Date().toLocaleString()}`);
		console.info(`[Main] NeutralinoJS Version: ${window.NL_VERSION}`);
		console.info(`[Main] ${(await shell('uname',["-a"])).stdOut.trim()}`);

		/** Launch the process manager */
		const watchdog = new AbloxWatchdog();
		watchdog.start().catch((err) => {
			console.error('[Watchdog] ', err);
		});
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
