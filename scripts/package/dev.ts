import spawn, { type SpawnPromise, type SpawnResult} from '@expo/spawn-async';
import path from 'path';
import { existsSync, chmodSync, rmSync } from 'fs';

async function main() {
	// Clear terminal
	process.stdout.write('\x1b[2J')
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
	const vite = spawn('vite', ["dev"], {
		cwd: process.cwd(),
		detached: false,
		stdio: 'inherit',
	});
	// Delay to be sure vite was built
	console.log("Waiting 2500ms...")
	await new Promise(r => setTimeout(r, 2500));

	const args = [
		'--window-enable-inspector=true',
		'--export-auth-info',
		'--load-dir-res',
		`--path=${path.resolve('.')}`,
		'--neu-dev-extension',
		'--url=http://localhost:5173',
		"--port=5174"
	];
	// Chmod +x the binary to be able to run it
	let bpath: string;
	if (process.platform !== "win32") {
		bpath = path.resolve(`./bin/neutralino-${binaryOS}_${process.arch}`)
		chmodSync(bpath,"755");
	} else {
		bpath = 'start ' + path.resolve(`./bin/neutralino-${binaryOS}_x64.exe`)
	}
	
	await spawn(bpath, args, {
		cwd: process.cwd(),
		detached: false,
		stdio: 'inherit',
	}).child.on('close', () => {
		vite.child.kill();
		process.exit();
	});
}

// If the binary folder doesn't exist, then we download it
if (!existsSync(path.resolve('./bin'))) {
	spawn('npx', ['neu', 'update'], {
		cwd: process.cwd(),
		detached: false,
		stdio: 'inherit',
	}).child.on('exit', main);
} else {
	main();
}
