import { $, sleep } from 'bun';
import { exists, readdir } from 'fs/promises';
import { join, resolve } from 'node:path';
import { Signale } from 'signale';

export async function buildViteAndNeu() {
	if (!(await checkNeutralino())) {
		await $`bunx neu update`;
	}

	const frontBuildLog = new Signale({
		interactive: true,
		scope: 'vite-neutralino',
	});
	frontBuildLog.await('Building with Vite');
	await $`rm -rf "${resolve('frontend/dist')}"`;
	$`bunx vite build'`.catch(async (err) => {
		await Bun.sleep(1000);
		frontBuildLog.fatal('A vite error occured:');
		frontBuildLog.fatal(err);
		process.exit();
	});
	while (!(await exists(resolve('./frontend/dist')))) {
		await sleep(1000);
	}

	process.stdout.write('\x1b[2J');
	process.stdout.write('\x1b[0f');

	frontBuildLog.await('Building with Neutralino');
	await sleep(500);
	await $`bunx neu build`;

	process.stdout.write('\x1b[2J');
	process.stdout.write('\x1b[0f');

	frontBuildLog.complete('Downloaded Neutralino binaries');
}

export async function getAllFilesInFolder(folderPath: string): Promise<string[]> {
	const files: string[] = [];

	async function readDirectory(directory: string): Promise<void> {
		const entries = await readdir(directory, { withFileTypes: true });

		for (const entry of entries) {
			const entryPath = join(directory, entry.name);

			if (entry.isDirectory()) {
				await readDirectory(entryPath); // Recursively read subdirectories
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
	const list = await $`ls bin`.text();
	if (!list.includes('neutralino')) return false;
	return true;
}
