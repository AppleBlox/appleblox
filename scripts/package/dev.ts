import type { Subprocess } from 'bun';
import { $, sleep } from 'bun';
import { chmodSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { buildSidecar } from '../build/ts/sidecar';
import { checkNeutralino } from '../build/ts/utils';

interface ServerInfo {
	process: Subprocess;
	port: number;
	url: string;
}

async function findAvailablePort(preferredPort: number, maxRetries = 10): Promise<number> {
	for (let i = 0; i < maxRetries; i++) {
		const portToTest = preferredPort + i;
		if (await isPortAvailable(portToTest)) {
			return portToTest;
		}
	}
	throw new Error(`No available port found starting from ${preferredPort}`);
}

function isPortAvailable(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();

		server.once('error', () => resolve(false));
		server.once('listening', () => {
			server.close();
			resolve(true);
		});

		server.listen(port);
	});
}

// async function waitForServer(url: string, maxAttempts = 30, interval = 1000): Promise<boolean> {
// 	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
// 		try {
// 			const response = await fetch(url, { method: 'HEAD' });
// 			if (response.ok) {
// 				console.log(`Server ready at ${url}`);
// 				return true;
// 			}
// 		} catch {
// 			// Server not ready yet
// 		}

// 		console.log(`Waiting for server... (${attempt}/${maxAttempts})`);
// 		await Bun.sleep(interval);
// 	}

// 	console.error(`Server failed to start at ${url} after ${maxAttempts} attempts`);
// 	return false;
// }

function clearTerminal(): void {
	process.stdout.write('\x1b[2J\x1b[0f');
}

function getBinaryPath(): string {
	// Since this is Mac exclusive, simplify the logic
	const binaryName = `neutralino-mac_${process.arch}`;
	const binaryPath = resolve(`./bin/${binaryName}`);

	if (!existsSync(binaryPath)) {
		throw new Error(`Binary not found: ${binaryPath}`);
	}

	return binaryPath;
}

function checkSidecar(): boolean {
	const requiredFiles = ['alerter_ablox', 'discordrpc_ablox', 'urlscheme_ablox', 'bootstrap_ablox'];

	for (const file of requiredFiles) {
		const filePath = resolve(join('bin', file));
		if (!existsSync(filePath)) {
			console.log(`Missing sidecar file: ${file}`);
			return false;
		}
	}

	console.log('All sidecar files present');
	return true;
}

async function setupEnvironment(downloadNeuBinaries: boolean, buildSidecarBinaries: boolean): Promise<void> {
	console.log('Setting up development environment...');

	if (downloadNeuBinaries) {
		console.log('Downloading Neutralino binaries...');
		await $`bunx neu update`;
		console.log('Neutralino binaries updated');
	}

	if (buildSidecarBinaries) {
		console.log('Building sidecar binaries...');
		await buildSidecar();
		console.log('Sidecar binaries built');
	}
}

async function startViteServer(preferredPort: number = 5173): Promise<ServerInfo> {
	const vitePort = await findAvailablePort(preferredPort);
	const viteUrl = `http://localhost:${vitePort}`;

	console.log(`Starting Vite dev server on port ${vitePort}...`);

	const viteProcess = Bun.spawn({
		cmd: ['bunx', 'vite', 'dev', '--port', vitePort.toString(), '--host'],
		stdout: 'inherit',
		stderr: 'inherit',
	});

	// Wait for Vite to be ready
	// const serverReady = await waitForServer(viteUrl);
	// if (!serverReady) {
	// 	viteProcess.kill();
	// 	throw new Error('Failed to start Vite server');
	// }

	await sleep(5000);

	return {
		process: viteProcess,
		port: vitePort,
		url: viteUrl,
	};
}

async function startNeutralinoApp(viteUrl: string, preferredPort: number = 5174): Promise<Subprocess> {
	const neutralinoPort = await findAvailablePort(preferredPort);
	const binaryPath = getBinaryPath();

	// Make binary executable
	chmodSync(binaryPath, '755');

	const args = [
		'--window-enable-inspector=true',
		'--load-dir-res',
		`--path=${resolve('.')}`,
		'--neu-dev-extension',
		`--url=${viteUrl}`,
		`--port=${neutralinoPort}`,
	];

	console.log(`Starting Neutralino app on port ${neutralinoPort}...`);
	console.log(`App will connect to: ${viteUrl}`);

	const neutralinoProcess = Bun.spawn([binaryPath, ...args], {
		cwd: process.cwd(),
		stdout: 'inherit',
		stderr: 'inherit',
	});

	return neutralinoProcess;
}

async function main(downloadNeuBinaries = false, createBinaries = false): Promise<void> {
	let viteServer: ServerInfo | null = null;
	let neutralinoProcess: Subprocess | null = null;

	try {
		clearTerminal();

		// Setup phase
		await setupEnvironment(downloadNeuBinaries, createBinaries);

		// Start Vite server and wait for it to be ready
		viteServer = await startViteServer();

		// Start Neutralino app
		neutralinoProcess = await startNeutralinoApp(viteServer.url);

		console.log('\nDevelopment environment ready!');
		console.log(`   Vite: ${viteServer.url}`);
		console.log(`   Neutralino: Running with PID ${neutralinoProcess.pid}`);
		console.log('\nPress Ctrl+C to stop all processes\n');
	} catch (error) {
		console.error('Failed to start development environment:', error);

		// Cleanup on error
		if (neutralinoProcess?.pid) {
			try {
				neutralinoProcess.kill();
			} catch (killError) {
				console.error('Error stopping Neutralino:', killError);
			}
		}

		if (viteServer?.process?.pid) {
			try {
				viteServer.process.kill();
			} catch (killError) {
				console.error('Error stopping Vite:', killError);
			}
		}

		process.exit(1);
	}

	// Cleanup handler
	const cleanup = () => {
		console.log('\nShutting down development environment...');

		if (neutralinoProcess?.pid) {
			try {
				neutralinoProcess.kill();
				console.log('Neutralino process stopped');
			} catch (error) {
				console.error('Error stopping Neutralino:', error);
			}
		}

		if (viteServer?.process?.pid) {
			try {
				viteServer.process.kill();
				console.log('Vite server stopped');
			} catch (error) {
				console.error('Error stopping Vite:', error);
			}
		}

		console.log('Goodbye!');
		process.exit(0);
	};

	// Handle process termination
	process.on('SIGINT', cleanup);
	process.on('SIGTERM', cleanup);

	// Wait for Neutralino process to exit
	if (neutralinoProcess) {
		neutralinoProcess.exited
			.then(() => {
				console.log('Neutralino app closed');
				cleanup();
			})
			.catch((error) => {
				console.error('Error waiting for Neutralino exit:', error);
				cleanup();
			});
	}
}

// Main execution
(async () => {
	try {
		const neutralinoExists = await checkNeutralino();
		const sidecarExists = checkSidecar();

		console.log(`Neutralino binaries: ${neutralinoExists ? 'Found' : 'Missing'}`);
		console.log(`Sidecar binaries: ${sidecarExists ? 'Found' : 'Missing'}\n`);

		await main(!neutralinoExists, !sidecarExists);
	} catch (error) {
		console.error('Initialization failed:', error);
		process.exit(1);
	}
})();
