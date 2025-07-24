// Init imports
import '@/theme.css';
import './app.css';
import './ts/debugging';
import './ts/roblox';
import './ts/window';

// Imports
import { events, init, app as neuApp, window as neuWindow, os } from '@neutralinojs/lib';
import App from './App.svelte';
import { loadTheme } from './components/theme-input/theme';
import Roblox from './ts/roblox';
import { RPCController } from './ts/tools/rpc';
import { shell } from './ts/tools/shell';
import { getMode } from './ts/utils';
import { logDebugInfo } from './ts/utils/debug';
import { focusWindow } from './ts/window';

// Initialize NeutralinoJS
init();

let isDeeplinkLaunch = false;
let mainAppMounted = false;

async function quit() {
	console.info('[Main] Exiting app');
	await RPCController.stop().catch((e) => console.warn('[Main] Error stopping RPC controller:', e));
	await shell('pkill', ['-f', '_ablox'], { skipStderrCheck: true }).catch((e) =>
		console.warn('[Main] Failed to pkill _ablox on quit:', e)
	);

	if (window.NL_ARGS.includes('--mode=browser') && mainAppMounted) {
		// Only write quit if main app was potentially loaded
		try {
			neuApp.writeProcessOutput('quit');
		} catch (e) {
			console.warn("[Main] Failed to write 'quit' to process output:", e);
		}
	}
	await neuApp.exit(0).catch((e) => console.error('[Main] Error on neuApp.exit:', e));
}

events.on('ready', async () => {
	await loadTheme();

	const deeplinkArg = window.NL_ARGS.find((arg) => arg.includes('--deeplink='));
	isDeeplinkLaunch = !!deeplinkArg;

	if (isDeeplinkLaunch && deeplinkArg) {
		console.info('[Main] Deeplink detected:', deeplinkArg);
		const url = deeplinkArg.slice(11);

		try {
			console.info(`[Main] Deeplink: Initiating Roblox launch with URL: ${url}`);
			await Roblox.launch(
				(isConnected) => console.log(`[Main Deeplink] Roblox Connected: ${isConnected}`),
				(isLaunching) => console.log(`[Main Deeplink] Launching Roblox State: ${isLaunching}`),
				async (title, description, code, flagNames) => {},
				url,
				false
			);
			// AppleBlox will stay running in the background to manage Roblox process / RPC
			// Main UI never loaded.
		} catch (error) {
			const errorMessage = `Critical error during deeplink launch: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[Main] ${errorMessage}`);
			try {
				await os.showMessageBox('Deeplink Launch Failed', errorMessage, os.MessageBoxChoice.OK);
			} catch (dialogError) {
				console.error('[Main Deeplink] Failed to show native error dialog for critical launch failure:', dialogError);
			}
			await neuApp.exit(1); // Exit if deeplink launch fails critically
		}
	} else {
		// No deeplink: Normal application startup
		console.info('[Main] No deeplink detected, loading main application UI.');
		await neuWindow.show();
		if (getMode() === 'prod') {
			try {
				await focusWindow();
			} catch (e) {
				console.warn('[Main] Failed to focus main window:', e);
			}
		}

		const appTarget = document.getElementById('app');
		if (appTarget) {
			new App({
				target: appTarget,
			});
			mainAppMounted = true;
		} else {
			console.error('[Main] Fatal: #app element not found in index.html for Svelte app mounting.');
			await os.showMessageBox('Startup Error', 'Could not initialize the main application UI.', os.MessageBoxChoice.OK);
			await neuApp.exit(1);
		}
	}

	setTimeout(async () => {
		console.info(`NeutralinoJS: Running at http://localhost:${window.NL_PORT}`);
		logDebugInfo();
	}, 500);
});

events.on('windowClose', quit);
events.on('exitApp', quit);

if (window.NL_ARGS.includes('--mode=browser')) {
	window.addEventListener('beforeunload', () => {
		if (mainAppMounted) {
			// Only attempt full quit if main app was likely running
			quit();
		}
	});
}
