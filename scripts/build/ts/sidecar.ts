import { $ } from 'bun';
import { chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Signale } from 'signale';
import { extract } from 'tar';

const DRPC_RELEASE = 'https://github.com/AppleBlox/Discord-RPC-cli/releases/download/1.0.0/discord-rpc-cli';
const ALERTER_RELEASE = 'https://github.com/vjeantet/alerter/releases/download/1.0.1/alerter_v1.0.1_darwin_amd64.zip';

export async function buildSidecar() {
	const logger = new Signale({ scope: 'sidecar' });

	const sidecarFiles: { name: string; filename: string; args: string[] }[] = [
		{
			name: 'Bootstrap',
			filename: 'bootstrap.m',
			args: ['-framework', 'Cocoa'],
		},
		{
			name: 'Urlscheme',
			filename: 'urlscheme.m',
			args: ['-framework', 'Foundation', '-framework', 'ApplicationServices'],
		},
		{
			name: 'Window Manager',
			filename: 'window_manager.mm',
			args: ['-framework', 'Foundation', '-framework', 'ApplicationServices'],
		},
	];

	await $`mkdir -p bin`
	for (const file of sidecarFiles) {
		logger.await(`Compiling "${file.name}"`);
		const perf = performance.now();
		const outPath = resolve(join('bin', file.filename.split('.')[0]));
		const filePath = resolve(join('scripts/build/sidecar', file.filename));
		const args = ['gcc', ...file.args, '-Wno-deprecated-declarations', filePath, '-o', outPath];
		await Bun.spawn(args).exited;
		logger.complete(`Compiled "${file.name} in ${((performance.now() - perf) / 1000).toFixed(3)}s`);
	}

	const drpcPath = resolve('bin/discordrpc_ablox');
	if (!(await Bun.file(drpcPath).exists())) {
		logger.info('Downloading DiscordRPC binary from repository releases...');
		const file = await fetch(DRPC_RELEASE, {
			method: 'GET',
		})
			.then((res) => res.blob())
			.then((blob) => blob);
		await Bun.write(drpcPath, file);
		chmodSync(drpcPath, 0o755);
		logger.complete('Downloaded discordrpc_ablox.');
	}

	if (!(await Bun.file(resolve('bin/alerter_ablox')).exists())) {
		logger.info('Downloading Alerter binary from repository releases...');
		const file = await fetch(ALERTER_RELEASE, {
			method: 'GET',
		})
			.then((res) => res.arrayBuffer())
			.then((arrayBuffer) => Buffer.from(arrayBuffer));

		const zipPath = resolve('bin/.temp/alerter.tar.gz');
		await Bun.write(zipPath, file);
		await extract({
			file: zipPath,
			cwd: resolve('bin/'),
		});
		await $`mv bin/alerter bin/alerter_ablox"`;

		logger.complete('Downloaded alerter_ablox.');
	}

	await $`rm -rf bin/.temp`;
}

if (import.meta.main) {
	buildSidecar();
}
