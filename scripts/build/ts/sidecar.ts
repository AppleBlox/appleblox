import { $ } from 'bun';
import { chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Signale } from 'signale';
import { extract } from 'tar';
import { version } from '../../../package.json';

const DRPC_RELEASE = 'https://github.com/AppleBlox/Discord-RPC-cli/releases/download/1.0.2/discord-rpc-cli';
const ALERTER_RELEASE = 'https://github.com/vjeantet/alerter/releases/download/1.0.1/alerter_v1.0.1_darwin_amd64.zip';

export type BuildArch = 'x64' | 'arm64' | 'universal';

type BaseFile = {
	name: string;
	filename: string;
	includeSuffix?: boolean;
};

type CompilableFile = BaseFile & {
	type: 'objective-c' | 'swift';
	args: string[];
};

type RepoFile = {
	name: string;
	url: string;
	outputName: string;
	buildOutput: string;  // path to the built binary within the cloned repo
	includeSuffix?: boolean;
	devBranch?: string;   // branch to use when building a dev version
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
		args: [
			'-framework', 'Security', '-framework', 'Foundation', '-framework', 'AppKit',
			'-sectcreate', '__TEXT', '__info_plist', 'scripts/build/sidecar/keychain_info.plist',
		],
		includeSuffix: true,
	},
	{
		name: 'Transparent Viewer',
		filename: 'transparent_viewer.swift',
		type: 'swift',
		args: ['-framework', 'Cocoa', '-framework', 'WebKit'],
		includeSuffix: true,
	},
	{
		name: 'Roblox Login WebView',
		filename: 'roblox_login.swift',
		type: 'swift',
		args: [
			'-framework', 'Cocoa', '-framework', 'WebKit', '-framework', 'Security',
			'-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', '__info_plist',
			'-Xlinker', 'scripts/build/sidecar/roblox_login_info.plist',
		],
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

const repoFiles: RepoFile[] = [
	{
		name: 'Virtual Display',
		url: 'https://github.com/AppleBlox/virtualdisplay.git',
		outputName: 'virtualdisplay_ablox',
		buildOutput: '.build/virtualdisplay',
		devBranch: 'dev',
	},
];

/** Returns architecture-specific compilation arguments for GCC and Swift targets. */
function getCompileArgs(arch: BuildArch) {
	const gccArchFlags: Record<BuildArch, string[]> = {
		x64: ['-arch', 'x86_64'],
		arm64: ['-arch', 'arm64'],
		universal: ['-arch', 'x86_64', '-arch', 'arm64'],
	};

	const swiftTargets: Record<BuildArch, string[]> = {
		x64: ['x86_64-apple-macos11.0'],
		arm64: ['arm64-apple-macos11.0'],
		universal: ['x86_64-apple-macos11.0', 'arm64-apple-macos11.0'],
	};

	return {
		gcc: {
			base: [
				'-Wno-deprecated-declarations',
				'-Wall',
				'-Wextra',
				'-mmacosx-version-min=10.13',
				...gccArchFlags[arch],
				'-isysroot',
				'/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk',
			],
		},
		swiftc: {
			targets: swiftTargets[arch],
		},
	};
}

/** Strips any existing -target flag and its value from an args array. */
function stripTargetFromArgs(args: string[]): string[] {
	const result: string[] = [];
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '-target') {
			i++; // skip the target value
		} else {
			result.push(args[i]);
		}
	}
	return result;
}

function getOutputPath(filename: string, includeSuffix: boolean = false, preserveExtension: boolean = false, outputDir: string = 'bin'): string {
	const parts = filename.split('.');
	const baseName = parts[0];
	const extension = preserveExtension && parts.length > 1 ? `.${parts.slice(1).join('.')}` : '';
	const suffix = includeSuffix ? '_ablox' : '';
	return resolve(join(outputDir, `${baseName}${suffix}${extension}`));
}

function getSourcePath(filename: string): string {
	return resolve(join('scripts/build/sidecar', filename));
}

async function compileFile(
	file: CompilableFile,
	logger: Signale,
	compileArgs: ReturnType<typeof getCompileArgs>,
	outputDir: string
): Promise<{ name: string; time: number; output: string }> {
	const perf = performance.now();

	const outPath = getOutputPath(file.filename, file.includeSuffix, false, outputDir);
	const filePath = getSourcePath(file.filename);
	const fileArgs = stripTargetFromArgs(file.args);

	try {
		if (file.type === 'objective-c') {
			const args = ['gcc', ...compileArgs.gcc.base, ...fileArgs, filePath, '-o', outPath];
			await Bun.spawn(args).exited;
			chmodSync(outPath, 0o755);
		} else if (file.type === 'swift') {
			const targets = compileArgs.swiftc.targets;

			if (targets.length === 1) {
				// Single architecture
				const args = ['swiftc', filePath, '-o', outPath, '-target', targets[0], ...fileArgs];
				await Bun.spawn(args).exited;
				chmodSync(outPath, 0o755);
			} else {
				// Universal: compile for each target, then lipo merge
				const tempOutputs: string[] = [];
				for (const target of targets) {
					const archName = target.split('-')[0]; // x86_64 or arm64
					const tempOut = `${outPath}.${archName}`;
					const args = ['swiftc', filePath, '-o', tempOut, '-target', target, ...fileArgs];
					await Bun.spawn(args).exited;
					tempOutputs.push(tempOut);
				}
				await Bun.spawn(['lipo', '-create', ...tempOutputs, '-output', outPath]).exited;
				chmodSync(outPath, 0o755);
				// Clean up temp files
				for (const temp of tempOutputs) {
					await $`rm -f ${temp}`;
				}
			}
		} else {
			throw new Error(`Unknown compilable type: ${file.type}`);
		}

		// Ad-hoc code sign the binary so macOS Keychain "Always Allow" persists
		// across app launches (the signature stays stable for the same build)
		await Bun.spawn(['codesign', '--sign', '-', '--force', outPath]).exited;

		const time = (performance.now() - perf) / 1000;
		const outputName = outPath.split('/').pop() || '';
		return { name: file.name, time, output: outputName };
	} catch (error) {
		logger.fatal(`Failed to compile "${file.name}": ${error}`);
		throw error;
	}
}

async function copyFile(file: CopyFile, logger: Signale, outputDir: string): Promise<{ name: string; time: number; output: string }> {
	const perf = performance.now();

	const outPath = getOutputPath(file.filename, file.includeSuffix, true, outputDir);
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

/**
 * Downloads a file to a shared cache directory (bin/), then copies it to the target output directory.
 * This avoids re-downloading the same file for each architecture variant.
 */
async function downloadFile(
	file: DownloadFile,
	logger: Signale,
	outputDir: string
): Promise<{ name: string; time: number; output: string; skipped?: boolean }> {
	const perf = performance.now();
	const cachePath = resolve(join('bin', file.outputName));
	const outPath = resolve(join(outputDir, file.outputName));

	// Download to shared cache if not already present
	if (!(await Bun.file(cachePath).exists())) {
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
						await $`mv bin/${file.extract.file} ${cachePath}`;
					}
				} else if (file.extract.type === 'zip') {
					const arrayBuffer = await response.arrayBuffer();
					const buffer = Buffer.from(arrayBuffer);
					const zipPath = join(tempDir, 'archive.zip');

					await Bun.write(zipPath, buffer);
					await $`unzip -q ${zipPath} -d ${tempDir}`;

					if (file.extract.file) {
						await $`mv ${tempDir}/${file.extract.file} ${cachePath}`;
					}
				}
			} else {
				const blob = await response.blob();
				await Bun.write(cachePath, blob);
			}

			chmodSync(cachePath, 0o755);
		} catch (error) {
			logger.fatal(`Failed to download "${file.name}": ${error}`);
			throw error;
		}
	}

	// Copy from cache to output directory if they differ
	if (resolve(outputDir) !== resolve('bin')) {
		await $`cp "${cachePath}" "${outPath}"`;
		chmodSync(outPath, 0o755);
	}

	const time = (performance.now() - perf) / 1000;
	const skipped = time < 0.01;
	return { name: file.name, time, output: file.outputName, skipped };
}

/**
 * Clone a git repo, build it with `make`, and copy the resulting binary to outputDir.
 * For universal builds, compiles for both arm64 and x86_64 then merges with lipo.
 */
async function buildRepo(
	file: RepoFile,
	logger: Signale,
	arch: BuildArch,
	outputDir: string
): Promise<{ name: string; time: number; output: string }> {
	const perf = performance.now();
	const outPath = resolve(join(outputDir, file.outputName));
	const repoDir = resolve(join('bin/.repos', file.outputName));

	const isDevVersion = version.includes('-dev.');
	const branch = isDevVersion && file.devBranch ? ['--branch', file.devBranch] : [];

	await $`rm -rf ${repoDir}`;
	await $`git clone --depth=1 ${branch} ${file.url} ${repoDir}`;

	const makeArchs: Record<BuildArch, string[]> = {
		arm64: ['arm64'],
		x64: ['x86_64'],
		universal: ['arm64', 'x86_64'],
	};

	const archs = makeArchs[arch];

	if (archs.length === 1) {
		await $`make -C ${repoDir} ARCH=${archs[0]}`;
		await $`cp ${join(repoDir, file.buildOutput)} ${outPath}`;
	} else {
		// Universal: build each arch separately, merge with lipo
		const tempOutputs: string[] = [];
		for (const a of archs) {
			await $`make -C ${repoDir} clean`;
			await $`make -C ${repoDir} ARCH=${a}`;
			const tempOut = `${outPath}.${a}`;
			await $`cp ${join(repoDir, file.buildOutput)} ${tempOut}`;
			tempOutputs.push(tempOut);
		}
		await Bun.spawn(['lipo', '-create', ...tempOutputs, '-output', outPath]).exited;
		for (const temp of tempOutputs) {
			await $`rm -f ${temp}`;
		}
	}

	chmodSync(outPath, 0o755);
	await Bun.spawn(['codesign', '--sign', '-', '--force', outPath]).exited;

	const time = (performance.now() - perf) / 1000;
	return { name: file.name, time, output: file.outputName };
}

/**
 * Build sidecar binaries for a specific architecture.
 * @param arch - Target architecture (x64, arm64, or universal). Defaults to universal.
 * @param outputDir - Output directory path. Defaults to 'bin'.
 */
export async function buildSidecar(arch: BuildArch = 'universal', outputDir?: string) {
	const logger = new Signale({ scope: 'sidecar' });
	const startTime = performance.now();
	const binDir = outputDir ?? resolve('bin');

	await $`mkdir -p bin`;     // Shared cache for downloads
	await $`mkdir -p ${binDir}`;

	const compileArgs = getCompileArgs(arch);

	// Separate files by type for organized output
	const compileFiles = sidecarFiles.filter((f) => f.type !== 'copy') as CompilableFile[];
	const scriptFiles = sidecarFiles.filter((f) => f.type === 'copy') as CopyFile[];

	logger.info(`Building ${sidecarFiles.length} sidecar binaries + ${downloadFiles.length} downloads + ${repoFiles.length} repos (${arch})`);

	try {
		// Process all files in parallel
		const [compileResults, copyResults, downloadResults, repoResults] = await Promise.all([
			Promise.all(compileFiles.map((f) => compileFile(f, logger, compileArgs, binDir))),
			Promise.all(scriptFiles.map((f) => copyFile(f, logger, binDir))),
			Promise.all(downloadFiles.map((f) => downloadFile(f, logger, binDir))),
			Promise.all(repoFiles.map((f) => buildRepo(f, logger, arch, binDir))),
		]);

		// Display summary
		if (compileResults.length > 0) {
			logger.success(`Compiled ${compileResults.length} binary(ies) [${arch}]: ${compileResults.map((r) => r.output).join(', ')}`);
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

		if (repoResults.length > 0) {
			logger.success(`Built ${repoResults.length} repo(s): ${repoResults.map((r) => r.output).join(', ')}`);
		}

		const totalTime = ((performance.now() - startTime) / 1000).toFixed(3);
		logger.complete(`All sidecar binaries ready [${arch}] (${totalTime}s)`);
	} catch (error) {
		logger.fatal('Failed to build sidecar binaries');
		throw error;
	} finally {
		await $`rm -rf bin/.temp bin/.repos`;
	}
}

if (import.meta.main) {
	const arch = (process.env.BUILD_ARCH?.toLowerCase() as BuildArch) || 'universal';
	buildSidecar(arch);
}
