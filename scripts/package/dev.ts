import { $ } from 'bun';
import { chmodSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildSidecar } from '../build/ts/sidecar';
import { checkNeutralino } from '../build/ts/utils';

async function main(downloadNeuBinaries = false, createBinaries = false) {
	if (downloadNeuBinaries) {
		await $`bunx neu update`;
	}
	if (createBinaries) {
		await buildSidecar();
	}

	// Clear terminal
	process.stdout.write('\x1b[2J');
	process.stdout.write('\x1b[0f');

	// Get the correct binary name
	let binaryOS = 'linux';
	switch (process.platform) {
		case 'darwin':
			binaryOS = 'mac';
			break;
		case 'win32':
			binaryOS = 'win';
			break;
		default:
			break;
	}
	// Start the vite dev server
	const vite = Bun.spawn({
		cmd: ['bunx', 'vite', 'dev'],
		stdout: 'inherit',
		stderr: 'inherit',
	});
	// Delay to be sure vite was built
	await Bun.sleep(2500);

	const args = [
		'--window-enable-inspector=true',
		'--load-dir-res',
		`--path=${resolve('.')}`,
		'--neu-dev-extension',
		'--url=http://localhost:5173',
		'--port=5174',
	];
	// Chmod +x the binary to be able to run it
	let bpath: string;
	if (process.platform !== 'win32') {
		bpath = resolve(`./bin/neutralino-${binaryOS}_${process.arch}`);

		chmodSync(bpath, '755');
	} else {
		bpath = `start ${resolve(`./bin/neutralino-${binaryOS}_x64.exe`)}`;
	}

	Bun.spawn([bpath, ...args], {
		cwd: process.cwd(),
		onExit() {
			process.kill(vite.pid);
			process.exit();
		},
	});
}

function checkSidecar(): boolean {
	const files = ['alerter_ablox', 'discordrpc_ablox', 'urlscheme_ablox', 'bootstrap_ablox'];
	for (const file of files) {
		const filePath = resolve(join('bin', file));
		if (!existsSync(filePath)) return false;
	}
	return true;
}

// If the binary folder doesn't exist, then we download it
checkNeutralino().then(async (exists) => {
	main(!exists, !checkSidecar());
});
