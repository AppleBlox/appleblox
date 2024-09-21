// Init imports
import './app.css';
import './ts/window';
import './ts/roblox';
import './ts/debugging';

// Imports
import { events, os, init, app as neuApp } from '@neutralinojs/lib';
import { version } from '../../../../package.json';
import App from './App.svelte';
import { RPCController } from './ts/tools/rpc';
import { AbloxWatchdog } from './ts/watchdog';

// Initialize NeutralinoJS
init();

async function quit() {
	console.log('Exiting app');
	await RPCController.stop();
	await neuApp.exit();
}

// When NeutralinoJS is ready:
events.on('ready', async () => {
	setTimeout(async () => {
		console.log('\n');
		console.log('===========');
		console.log(`AppleBlox v${version}`);
		console.log(`Current Time: ${new Date().toLocaleString()}`);
		console.log(`NeutralinoJS Version: ${window.NL_VERSION}`);
		console.log(`${(await os.execCommand('uname -a')).stdOut.trim()}`);
		console.log('===========');

		/** Launch the process manager */
		const watchdog = new AbloxWatchdog();
		watchdog.start().catch(console.error);
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
