// Init imports
import '@/theme.css';
import './app.css';
import './ts/roblox';
import './ts/window';

// Imports
import { events, init, MessageBoxChoice, app as neuApp, window as neuWindow, os, filesystem } from '@neutralinojs/lib';
import App from './App.svelte';
import { loadTheme } from './components/theme-input/theme';
import Roblox from './ts/roblox';
import { RPCController } from './ts/tools/rpc';
import { shell } from './ts/tools/shell';
import { getMode, sleep } from './ts/utils';
import { logDebugInfo } from './ts/utils/debug';
import Logger, { initializeLogger } from '@/windows/main/ts/utils/logger';
import { initializeDataDirectory } from './ts/utils/paths';
import { focusWindow, setWindowVisibility } from './ts/window';

const COMMAND_FILE = '/tmp/appleblox-bootstrap-command';
let lastCommandTimestamp = 0;

async function handleBootstrapCommand(command: string) {
	const cmd = command.trim();
	Logger.info(`Bootstrap command received: ${cmd}`);

	try {
		switch (cmd) {
			case 'hide':
				await setWindowVisibility(false);
				Logger.info('Window hidden via bootstrap command');
				break;
			case 'show':
				await setWindowVisibility(true);
				await focusWindow();
				Logger.info('Window shown via bootstrap command');
				break;
			default:
				Logger.warn(`Unknown bootstrap command: ${cmd}`);
		}
	} catch (error) {
		Logger.error(`Error executing bootstrap command "${cmd}":`, error);
	}
}

async function pollBootstrapCommands() {
	try {
		// Check if command file exists and read it
		const stats = await filesystem.getStats(COMMAND_FILE);
		const modTime = stats.modifiedAt;

		// Only process if file was modified since last check
		if (modTime > lastCommandTimestamp) {
			lastCommandTimestamp = modTime;
			const content = await filesystem.readFile(COMMAND_FILE);
			const command = content.trim();

			if (command) {
				await handleBootstrapCommand(command);
				// Clear the file after processing
				await filesystem.writeFile(COMMAND_FILE, '');
			}
		}
	} catch (error) {}

	setTimeout(pollBootstrapCommands, 100);
}

// Initialize NeutralinoJS
init();

// Initialize data directory (must be done after init())
initializeDataDirectory().catch((err) => {
	Logger.error('Failed to initialize data directory:', err);
});

let isDeeplinkLaunch = false;
let mainAppMounted = false;
let isQuitting = false;

async function quit() {
	if (isQuitting) return;
	isQuitting = true;

	Logger.info('Exiting app');

	try {
		await RPCController.stop();
	} catch (e) {
		Logger.warn('Error stopping RPC controller:', e);
	}

	try {
		await shell('pkill', ['-f', '_ablox'], { skipStderrCheck: true });
	} catch (e) {
		Logger.warn('Failed to pkill _ablox on quit:', e);
	}

	if (window.NL_ARGS.includes('--mode=browser')) {
		// 	// Only write quit if main app was potentially loaded
		try {
			neuApp.writeProcessOutput('quit');
		} catch (e) {
			Logger.warn("Failed to write 'quit' to process output:", e);
			await neuApp.exit(0);
		}
	}
	if (getMode() === 'dev') {
		await neuApp.exit(0);
	} else {
		shell(`osascript -e 'tell application id "ch.origaming.appleblox" to quit'`, [], { completeCommand: true });
	}
}

events.on('ready', async () => {
	// Initialize the logger as the first, non-blocking step.
	setTimeout(initializeLogger, 0);

	// Start polling for bootstrap commands
	setTimeout(pollBootstrapCommands, 100);

	// Make theme loading non-blocking
	setTimeout(async () => {
		try {
			await loadTheme();
		} catch (e) {
			Logger.warn('Error loading theme:', e);
		}
	}, 0);

	const deeplinkArg = window.NL_ARGS.find((arg) => arg.includes('--deeplink='));
	isDeeplinkLaunch = !!deeplinkArg;

	if (isDeeplinkLaunch && deeplinkArg) {
		Logger.info('Deeplink detected:', deeplinkArg);
		let url = deeplinkArg.slice(11);
		let deeplinkLogger = Logger.withContext('deeplink');
		try {
			Logger.info(`Deeplink: Initiating Roblox launch with URL: ${url}`);
			if (url === 'appleblox://launch') {
				url = 'roblox-player:';
			}
			setTimeout(async () => {
				try {
					await Roblox.launch(
						(isConnected) => deeplinkLogger.info(`Roblox Connected: ${isConnected}`),
						(isLaunching) => deeplinkLogger.info(`Launching Roblox State: ${isLaunching}`),
						async (title, description, code, flagNames) => {},
						url,
						false
					);
					// AppleBlox will stay running in the background to manage Roblox process / RPC
					// Main UI never loaded.
				} catch (error) {
					const errorMessage = `Critical error during deeplink launch: ${error instanceof Error ? error.message : String(error)}`;
					Logger.error(`${errorMessage}`);
					try {
						await os.showMessageBox('Deeplink Launch Failed', errorMessage, MessageBoxChoice.OK);
					} catch (dialogError) {
						deeplinkLogger.error('Failed to show native error dialog for critical launch failure:', dialogError);
					}
					await neuApp.exit(1); // Exit if deeplink launch fails critically
				}
			}, 0);
		} catch (error) {
			const errorMessage = `Critical error during deeplink launch: ${error instanceof Error ? error.message : String(error)}`;
			Logger.error(`${errorMessage}`);
			try {
				await os.showMessageBox('Deeplink Launch Failed', errorMessage, MessageBoxChoice.OK);
			} catch (dialogError) {
				deeplinkLogger.error('Failed to show native error dialog for critical launch failure:', dialogError);
			}
			await neuApp.exit(1); // Exit if deeplink launch fails critically
		}
	} else {
		// No deeplink: Normal application startup
		Logger.info('No deeplink detected, loading main application UI.');

		// Make window showing non-blocking
		setTimeout(async () => {
			try {
				await neuWindow.show();
				if (getMode() === 'prod') {
					try {
						await focusWindow();
					} catch (e) {
						Logger.warn('Failed to focus main window:', e);
					}
				}
			} catch (e) {
				Logger.warn('Error showing window:', e);
			}
		}, 0);

		try {
			const appTarget = document.getElementById('app');
			if (appTarget) {
				new App({
					target: appTarget,
				});
				mainAppMounted = true;
				Logger.info('Main application UI mounted successfully.');
			} else {
				Logger.error('Fatal: #app element not found in index.html for Svelte app mounting.');
				setTimeout(async () => {
					try {
						await os.showMessageBox(
							'Startup Error',
							'Could not initialize the main application UI.',
							MessageBoxChoice.OK
						);
						await neuApp.exit(1);
					} catch (e) {
						Logger.error('Error showing startup error dialog:', e);
					}
				}, 0);
			}
		} catch (e) {
			Logger.error('Error mounting Svelte app:', e);
		}
	}

	// Make debug logging non-blocking
	try {
		Logger.info(`NeutralinoJS: Running at http://localhost:${window.NL_PORT}`);
		logDebugInfo();
	} catch (e) {
		Logger.warn('Error logging debug info:', e);
	}
});

events.on('windowClose', () => {
	setTimeout(() => {
		quit();
	}, 0);
});

events.on('exitApp', () => {
	setTimeout(() => {
		quit();
	}, 0);
});

if (window.NL_ARGS.includes('--mode=browser')) {
	window.addEventListener('beforeunload', () => {
		if (mainAppMounted && !isQuitting) {
			setTimeout(() => {
				quit();
			}, 0);
		}
	});
}
