import { $ } from 'bun';
import { chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Signale } from 'signale';
import { extract } from 'tar';

const DRPC_RELEASE = 'https://github.com/AppleBlox/Discord-RPC-cli/releases/download/1.0.2/discord-rpc-cli';
const ALERTER_RELEASE = 'https://github.com/vjeantet/alerter/releases/download/1.0.1/alerter_v1.0.1_darwin_amd64.zip';

type BaseFile = {
	name: string;
	filename: string;
	includeSuffix?: boolean;
};

type CompilableFile = BaseFile & {
	type: 'objective-c' | 'swift';
	args: string[];
};

type CopyFile = BaseFile & {
	type: 'copy';
};

type DownloadFile = {
	name: string;
	url: string;
	outputName: string;
	extract?: {
		type: 'tar' | 'zip';
		file?: string;
	};
};

type SidecarFile = CompilableFile | CopyFile;

const sidecarFiles: SidecarFile[] = [
	{
		name: 'Bootstrap',
		filename: 'bootstrap.m',
		type: 'objective-c',
		args: ['-framework', 'Cocoa'],
		includeSuffix: true,
	},
	{
		name: 'URL Scheme Handler',
		filename: 'urlscheme.m',
		type: 'objective-c',
		args: ['-framework', 'Foundation', '-framework', 'ApplicationServices'],
		includeSuffix: true,
	},
	{
		name: 'Keychain Helper',
		filename: 'keychain.m',
		type: 'objective-c',
		args: ['-framework', 'Security', '-framework', 'Foundation'],
		includeSuffix: true,
	},
	{
		name: 'Transparent Viewer',
		filename: 'transparent_viewer.swift',
		type: 'swift',
		args: ['-framework', 'Cocoa', '-framework', 'WebKit', '-target', 'x86_64-apple-macos11.0'],
		includeSuffix: true,
	},
	{
		name: 'Roblox Login WebView',
		filename: 'roblox_login.swift',
		type: 'swift',
		args: ['-framework', 'Cocoa', '-framework', 'WebKit', '-framework', 'Security', '-target', 'x86_64-apple-macos11.0'],
		includeSuffix: true,
	},
	{
		name: 'Roblox Updater Script',
		filename: 'roblox_updater.sh',
		type: 'copy',
		includeSuffix: true,
	},
	{
		name: 'Roblox Updater Manager Script',
		filename: 'roblox_updater_manager.sh',
		type: 'copy',
		includeSuffix: true,
	},
	{
		name: 'Roblox Updater Script Plist',
		filename: 'rbxupdater.plist',
		type: 'copy',
		includeSuffix: true,
	},
];

const downloadFiles: DownloadFile[] = [
	{
		name: 'Discord RPC CLI',
		url: DRPC_RELEASE,
		outputName: 'discordrpc_ablox',
	},
	{
		name: 'Alerter',
		url: ALERTER_RELEASE,
		outputName: 'alerter_ablox',
		extract: {
			type: 'tar',
			file: 'alerter',
		},
	},
];

const COMPILE_ARGS = {
	gcc: {
		base: [
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
		],
	},
	swiftc: {
		base: [],
	},
};

function getOutputPath(filename: string, includeSuffix: boolean = false, preserveExtension: boolean = false): string {
	const parts = filename.split('.');
	const baseName = parts[0];
	const extension = preserveExtension && parts.length > 1 ? `.${parts.slice(1).join('.')}` : '';
	const suffix = includeSuffix ? '_ablox' : '';
	return resolve(join('bin', `${baseName}${suffix}${extension}`));
}

function getSourcePath(filename: string): string {
	return resolve(join('scripts/build/sidecar', filename));
}

async function compileFile(file: CompilableFile, logger: Signale): Promise<{ name: string; time: number; output: string }> {
	const perf = performance.now();

	const outPath = getOutputPath(file.filename, file.includeSuffix, false); // Don't preserve extension for compiled files
	const filePath = getSourcePath(file.filename);

	let args: string[];

	if (file.type === 'swift') {
		args = ['swiftc', filePath, '-o', outPath, ...COMPILE_ARGS.swiftc.base, ...file.args];
	} else if (file.type === 'objective-c') {
		args = ['gcc', ...COMPILE_ARGS.gcc.base, ...file.args, filePath, '-o', outPath];
	} else {
		throw new Error(`Unknown compilable type: ${file.type}`);
	}

	try {
		await Bun.spawn(args).exited;
		chmodSync(outPath, 0o755);
		const time = (performance.now() - perf) / 1000;
		const outputName = outPath.split('/').pop() || '';
		return { name: file.name, time, output: outputName };
	} catch (error) {
		logger.fatal(`Failed to compile "${file.name}": ${error}`);
		throw error;
	}
}

async function copyFile(file: CopyFile, logger: Signale): Promise<{ name: string; time: number; output: string }> {
	const perf = performance.now();

	const outPath = getOutputPath(file.filename, file.includeSuffix, true); // Preserve extension for copied files
	const filePath = getSourcePath(file.filename);

	try {
		await Bun.write(outPath, Bun.file(filePath));
		chmodSync(outPath, 0o755);
		const time = (performance.now() - perf) / 1000;
		const outputName = outPath.split('/').pop() || '';
		return { name: file.name, time, output: outputName };
	} catch (error) {
		logger.fatal(`Failed to copy "${file.name}": ${error}`);
		throw error;
	}
}

async function downloadFile(
	file: DownloadFile,
	logger: Signale
): Promise<{ name: string; time: number; output: string; skipped?: boolean }> {
	const perf = performance.now();
	const outPath = resolve(join('bin', file.outputName));

	if (await Bun.file(outPath).exists()) {
		return { name: file.name, time: 0, output: file.outputName, skipped: true };
	}

	try {
		const response = await fetch(file.url, { method: 'GET' });

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		if (file.extract) {
			const tempDir = resolve('bin/.temp');
			await $`mkdir -p ${tempDir}`;

			if (file.extract.type === 'tar') {
				const arrayBuffer = await response.arrayBuffer();
				const buffer = Buffer.from(arrayBuffer);
				const archivePath = join(tempDir, 'archive.tar.gz');

				await Bun.write(archivePath, buffer);
				await extract({ file: archivePath, cwd: resolve('bin/') });

				if (file.extract.file) {
					await $`mv bin/${file.extract.file} ${outPath}`;
				}
			} else if (file.extract.type === 'zip') {
				const arrayBuffer = await response.arrayBuffer();
				const buffer = Buffer.from(arrayBuffer);
				const zipPath = join(tempDir, 'archive.zip');

				await Bun.write(zipPath, buffer);
				await $`unzip -q ${zipPath} -d ${tempDir}`;

				if (file.extract.file) {
					await $`mv ${tempDir}/${file.extract.file} ${outPath}`;
				}
			}
		} else {
			const blob = await response.blob();
			await Bun.write(outPath, blob);
		}

		chmodSync(outPath, 0o755);
		const time = (performance.now() - perf) / 1000;
		return { name: file.name, time, output: file.outputName };
	} catch (error) {
		logger.fatal(`Failed to download "${file.name}": ${error}`);
		throw error;
	}
}

export async function buildSidecar() {
	const logger = new Signale({ scope: 'sidecar' });
	const startTime = performance.now();

	await $`mkdir -p bin`;

	// Separate files by type for organized output
	const compileFiles = sidecarFiles.filter((f) => f.type !== 'copy') as CompilableFile[];
	const copyFiles = sidecarFiles.filter((f) => f.type === 'copy') as CopyFile[];

	logger.info(`Building ${sidecarFiles.length} sidecar binaries + ${downloadFiles.length} downloads`);

	try {
		// Process all files in parallel
		const [compileResults, copyResults, downloadResults] = await Promise.all([
			Promise.all(compileFiles.map((f) => compileFile(f, logger))),
			Promise.all(copyFiles.map((f) => copyFile(f, logger))),
			Promise.all(downloadFiles.map((f) => downloadFile(f, logger))),
		]);

		// Display summary
		if (compileResults.length > 0) {
			logger.success(`Compiled ${compileResults.length} binary(ies): ${compileResults.map((r) => r.output).join(', ')}`);
		}

		if (copyResults.length > 0) {
			logger.success(`Copied ${copyResults.length} file(s): ${copyResults.map((r) => r.output).join(', ')}`);
		}

		const downloaded = downloadResults.filter((r) => !r.skipped);
		const skipped = downloadResults.filter((r) => r.skipped);

		if (downloaded.length > 0) {
			logger.success(`Downloaded ${downloaded.length} file(s): ${downloaded.map((r) => r.output).join(', ')}`);
		}

		if (skipped.length > 0) {
			logger.info(`Skipped ${skipped.length} existing file(s): ${skipped.map((r) => r.output).join(', ')}`);
		}

		const totalTime = ((performance.now() - startTime) / 1000).toFixed(3);
		logger.complete(`All sidecar binaries ready (${totalTime}s)`);
	} catch (error) {
		logger.fatal('Failed to build sidecar binaries');
		throw error;
	} finally {
		await $`rm -rf bin/.temp`;
	}
}

if (import.meta.main) {
	buildSidecar();
}
