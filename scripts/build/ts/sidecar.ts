import { $ } from 'bun';
import { chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Signale } from 'signale';
import { extract } from 'tar';

const DRPC_RELEASE = 'https://github.com/AppleBlox/Discord-RPC-cli/releases/download/1.0.0/discord-rpc-cli';
const ALERTER_RELEASE = 'https://github.com/vjeantet/alerter/releases/download/1.0.1/alerter_v1.0.1_darwin_amd64.zip';

export async function buildSidecar() {
	const logger = new Signale({ scope: 'sidecar' });

	const sidecarFiles: {
		name: string;
		filename: string;
		args: string[];
		includeSuffix?: boolean;
		isSwift?: boolean;
	}[] = [
		{
			name: 'Bootstrap',
			filename: 'bootstrap.m',
			args: ['-framework', 'Cocoa'],
		},
		{
			name: 'URL Scheme Handler',
			filename: 'urlscheme.m',
			args: ['-framework', 'Foundation', '-framework', 'ApplicationServices'],
			includeSuffix: true,
		},
		{
			name: 'Transparent Viewer',
			filename: 'transparent_viewer.swift',
			args: ['-framework', 'Cocoa', '-framework', 'WebKit', '-target', 'x86_64-apple-macos11.0'],
			includeSuffix: true,
			isSwift: true,
		},
	];

	await $`mkdir -p bin`;

	// Compile sidecar binaries in parallel for better performance
	const compilePromises = sidecarFiles.map(async (file) => {
		const fileLogger = new Signale({ scope: `compile-${file.name.toLowerCase().replace(/\s+/g, '-')}` });
		fileLogger.await(`Compiling "${file.name}"`);
		const perf = performance.now();

		const outPath = resolve(join('bin', `${file.filename.split('.')[0]}${file.includeSuffix === true ? '_ablox' : ''}`));
		const filePath = resolve(join('scripts/build/sidecar', file.filename));

		let args: string[];
		if (file.isSwift) {
			args = ['swiftc', filePath, '-o', outPath, ...file.args];
		} else {
			args = [
				'gcc',
				'-Wno-deprecated-declarations',
				'-Wall',
				'-Wextra',
				'-mmacosx-version-min=10.13',
				'-arch',
				'x86_64',
				'-arch',
				'arm64',
				'-isysroot',
				'/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk',
				...file.args,
				filePath,
				'-o',
				outPath,
			];
		}

		try {
			await Bun.spawn(args).exited;
			chmodSync(outPath, 0o755);
			fileLogger.complete(`Compiled "${file.name}" in ${((performance.now() - perf) / 1000).toFixed(3)}s`);
		} catch (error) {
			fileLogger.fatal(`Failed to compile "${file.name}": ${error}`);
			throw error;
		}
	});

	// Download external binaries in parallel
	const downloadPromises = [];

	// Download Discord RPC CLI if not exists
	const drpcPath = resolve('bin/discordrpc_ablox');
	if (!(await Bun.file(drpcPath).exists())) {
		downloadPromises.push(
			(async () => {
				const drpcLogger = new Signale({ scope: 'download-drpc' });
				drpcLogger.await('Downloading Discord RPC CLI binary...');

				try {
					const file = await fetch(DRPC_RELEASE, { method: 'GET' }).then((res) => res.blob());
					await Bun.write(drpcPath, file);
					chmodSync(drpcPath, 0o755);
					drpcLogger.complete('Downloaded discordrpc_ablox');
				} catch (error) {
					drpcLogger.fatal(`Failed to download Discord RPC CLI: ${error}`);
					throw error;
				}
			})()
		);
	}

	// Download Alerter if not exists
	const alerterPath = resolve('bin/alerter_ablox');
	if (!(await Bun.file(alerterPath).exists())) {
		downloadPromises.push(
			(async () => {
				const alerterLogger = new Signale({ scope: 'download-alerter' });
				alerterLogger.await('Downloading Alerter binary...');

				try {
					const file = await fetch(ALERTER_RELEASE, { method: 'GET' })
						.then((res) => res.arrayBuffer())
						.then((arrayBuffer) => Buffer.from(arrayBuffer));

					const zipPath = resolve('bin/.temp/alerter.tar.gz');
					await $`mkdir -p ${resolve('bin/.temp')}`;
					await Bun.write(zipPath, file);

					await extract({
						file: zipPath,
						cwd: resolve('bin/'),
					});

					await $`mv bin/alerter bin/alerter_ablox`;
					chmodSync(alerterPath, 0o755);

					alerterLogger.complete('Downloaded alerter_ablox');
				} catch (error) {
					alerterLogger.fatal(`Failed to download Alerter: ${error}`);
					throw error;
				}
			})()
		);
	}

	// Execute all tasks in parallel
	try {
		await Promise.all([...compilePromises, ...downloadPromises]);
		logger.success('All sidecar binaries built successfully');
	} catch (error) {
		logger.fatal('Failed to build sidecar binaries');
		throw error;
	} finally {
		// Cleanup temp directory
		await $`rm -rf bin/.temp`;
	}
}

if (import.meta.main) {
	buildSidecar();
}
