import { $ } from 'bun';
import { chmodSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

async function main(downloadNeuBinaries = false) {
	if (downloadNeuBinaries) {
		await $`bunx neu update`;
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
	console.log('Waiting 2500ms...');
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

// If the binary folder doesn't exist, then we download it
if (!existsSync(resolve('./bin'))) {
	main(true);
} else {
	main();
}
