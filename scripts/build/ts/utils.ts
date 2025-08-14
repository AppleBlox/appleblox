import { $, sleep } from 'bun';
import { exists, readdir } from 'fs/promises';
import { join, resolve } from 'node:path';
import { Signale } from 'signale';

export async function buildViteAndNeu(buildVite = true) {
	if (!(await checkNeutralino())) {
		await $`bunx neu update`;
	}

	const frontBuildLog = new Signale({
		interactive: true,
		scope: 'vite-neutralino',
	});

	if (buildVite) {
		frontBuildLog.await('Building with Vite');
		await $`rm -rf "${resolve('frontend/dist')}"`;
		
		try {
			await $`bunx vite build`;
			
			// Wait for build completion
			let attempts = 0;
			const maxAttempts = 30;
			while (!(await exists(resolve('./frontend/dist'))) && attempts < maxAttempts) {
				await sleep(1000);
				attempts++;
			}
			
			if (attempts >= maxAttempts) {
				throw new Error('Vite build timeout');
			}
		} catch (err) {
			frontBuildLog.fatal('A vite error occurred:');
			frontBuildLog.fatal(err);
			process.exit(1);
		}
	}

	// Clear terminal
	process.stdout.write('\x1b[2J');
	process.stdout.write('\x1b[0f');

	frontBuildLog.await('Building with Neutralino');
	await sleep(500);
	
	try {
		await $`bunx neu build`;
	} catch (err) {
		frontBuildLog.fatal('Neutralino build failed:');
		frontBuildLog.fatal(err);
		process.exit(1);
	}

	// Clear terminal again
	process.stdout.write('\x1b[2J');
	process.stdout.write('\x1b[0f');

	frontBuildLog.complete('Neutralino build completed');
}

export async function getAllFilesInFolder(folderPath: string): Promise<string[]> {
	const files: string[] = [];

	async function readDirectory(directory: string): Promise<void> {
		const entries = await readdir(directory, { withFileTypes: true });

		for (const entry of entries) {
			const entryPath = join(directory, entry.name);

			if (entry.isDirectory()) {
				await readDirectory(entryPath);
			} else {
				files.push(entryPath);
			}
		}
	}

	try {
		await readDirectory(folderPath);
		return files;
	} catch (error) {
		console.error(`Error reading directory: ${folderPath}`, error);
		throw error;
	}
}

export async function checkNeutralino(): Promise<boolean> {
	await $`mkdir -p bin`;
	try {
		const list = await $`ls bin`.text();
		return list.includes('neutralino');
	} catch {
		return false;
	}
}

export function getArchitectureFilter(): 'x64' | 'arm64' | 'universal' | null {
	const arch = process.env.BUILD_ARCH?.toLowerCase();
	if (arch && ['x64', 'arm64', 'universal'].includes(arch)) {
		return arch as 'x64' | 'arm64' | 'universal';
	}
	return null;
}

export function filterArchitectures(
	architectures: ('x64' | 'arm64' | 'universal')[],
	filter?: string | null
): ('x64' | 'arm64' | 'universal')[] {
	if (!filter || filter === 'all') {
		return architectures;
	}
	
	if (filter === 'universal' && architectures.includes('universal')) {
		return ['universal'];
	}
	
	return architectures.filter(arch => arch === filter);
}

export async function executeWithRetry<T>(
	operation: () => Promise<T>,
	maxRetries: number = 3,
	delay: number = 1000
): Promise<T> {
	let lastError: Error;
	
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error as Error;
			if (attempt < maxRetries) {
				console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
				await sleep(delay);
			}
		}
	}
	
	throw lastError!;
}

export function createProgressLogger(scope: string) {
	return new Signale({ scope, interactive: true });
}

export async function ensureDirectory(path: string): Promise<void> {
	await $`mkdir -p "${path}"`;
}

export async function copyWithProgress(
	source: string,
	destination: string,
	logger?: Signale
): Promise<void> {
	if (logger) {
		logger.await(`Copying ${source.split('/').pop()} to destination`);
	}
	
	await $`cp -r "${source}" "${destination}"`;
	
	if (logger) {
		logger.success(`Copied ${source.split('/').pop()}`);
	}
}

export async function validateMacExecutable(executablePath: string): Promise<boolean> {
	try {
		const result = await $`file "${executablePath}"`.text();
		return result.includes('Mach-O') && (result.includes('x86_64') || result.includes('arm64'));
	} catch {
		return false;
	}
}

export async function getMacExecutableArchs(executablePath: string): Promise<string[]> {
	try {
		const result = await $`lipo -archs "${executablePath}"`.text();
		return result.trim().split(/\s+/);
	} catch {
		return [];
	}
}

export async function runConcurrently<T>(
	tasks: (() => Promise<T>)[],
	maxConcurrency: number = 3
): Promise<T[]> {
	const results: T[] = [];
	const executing: Promise<void>[] = [];

	for (const task of tasks) {
		const promise = task().then(result => {
			results.push(result);
		});

		executing.push(promise);

		if (executing.length >= maxConcurrency) {
			await Promise.race(executing);
		}
	}

	await Promise.all(executing);
	return results;
}