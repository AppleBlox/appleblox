import './app.css';
import './ts/window';
import './ts/roblox/path';
import './ts/debugging';
import App from './App.svelte';
import { events, init, os } from '@neutralinojs/lib';
import { version } from '../../../../package.json';
import { RPCController } from './ts/rpc';
import { loadSettings } from './ts/settings';
import { AbloxWatchdog } from './ts/watchdog';

// Initialize NeutralinoJS
init();

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

		// DiscordRPC
		const settings = await loadSettings('integrations');
		if (settings && settings.rpc.enable_rpc) {
			await RPCController.set({
				clientId: '1257650541677383721',
				details: 'Currently in the launcher',
				largeImage: 'appleblox',
				largeImageText: 'AppleBlox Logo',
				enableTime: true,
			});
		}
	}, 500);
});

// Cleanup when the application is closing
events.on('windowClose', async () => {
	await RPCController.stop();
});

const app = new App({
	// @ts-expect-error
	target: document.getElementById('app'),
});

export default app;
