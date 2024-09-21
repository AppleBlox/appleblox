import { resolve } from 'node:path';
import { chmodSync } from 'node:fs';
import { Signale } from 'signale';
import { $ } from 'bun';
import { extract } from 'tar';

const DRPC_RELEASE = 'https://github.com/AppleBlox/Discord-RPC-cli/releases/download/1.0.0/discord-rpc-cli';
const ALERTER_RELEASE = 'https://github.com/vjeantet/alerter/releases/download/1.0.1/alerter_v1.0.1_darwin_amd64.zip';

export async function buildBinaries() {
	const logger = new Signale({ scope: 'binaries' });

	await $`rm -rf build/binaries/.temp`;
	await $`mkdir -p build/binaries/.temp`;
	await $`mkdir -p build/lib/MacOS`;
	logger.info('Building binaries...');
	let buildTime = performance.now();
	await $`clang++ -framework CoreGraphics -framework ApplicationServices build/binaries/window_manager.mm -o build/binaries/.temp/window_manager -arch arm64 -arch x86_64 -mmacosx-version-min=10.12 -std=c++11`;
	logger.complete(`window_manager.mm built in ${((performance.now() - buildTime) / 1000).toFixed(3)}s`);
	buildTime = performance.now();
	await $`clang -framework Foundation -framework CoreServices build/binaries/urlscheme.m -o build/binaries/.temp/urlscheme -arch x86_64 -arch arm64 -mmacosx-version-min=10.12`;
	logger.complete(`urlscheme.m built in ${((performance.now() - buildTime) / 1000).toFixed(3)}s`);
	buildTime = performance.now();
	await $`gcc build/binaries/watchdog.c -o build/binaries/.temp/watchdog`;
	logger.complete(`watchdog.c built in ${((performance.now() - buildTime) / 1000).toFixed(3)}s`);

	await $`rm -f build/lib/MacOS/window_manager`;
	await $`rm -f build/lib/MacOS/urlscheme`;
	await $`rm -f build/lib/MacOS/watchdog`;

	await $`cp build/binaries/.temp/window_manager build/lib/MacOS/window_manager`;
	await $`cp build/binaries/.temp/urlscheme build/lib/MacOS/urlscheme`;
	await $`cp build/binaries/.temp/watchdog build/lib/MacOS/watchdog`;

	const drpcPath = resolve('build/lib/MacOS/discordrpc_ablox');
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

	if (!(await Bun.file(resolve('build/lib/MacOS/alerter_ablox')).exists())) {
		logger.info('Downloading Alerter binary from repository releases...');
		const file = await fetch(ALERTER_RELEASE, {
			method: 'GET',
		})
			.then((res) => res.arrayBuffer())
			.then((arrayBuffer) => Buffer.from(arrayBuffer));

		const zipPath = resolve('build/binaries/.temp/alerter.tar.gz');
		await Bun.write(zipPath, file);
		await extract({
			file: zipPath,
			cwd: resolve('build/lib/MacOS/'),
		});
		await $`mv build/lib/MacOS/alerter build/lib/MacOS/alerter_ablox"`;

		logger.complete('Downloaded alerter_ablox.');
	}

	await $`rm -rf build/binaries/.temp`;
}
