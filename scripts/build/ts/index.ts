import BuildConfig from '@root/build.config';
import { $ } from 'bun';
import { resolve } from 'node:path';
import { Signale } from 'signale';
import { macBuild } from './mac-bundle';
import { buildSidecar } from './sidecar';
import { buildViteAndNeu, getArchitectureFilter } from './utils';

const { argv } = process;

export async function build() {
	$.cwd(process.cwd());
	const initTime = performance.now();
	const logger = new Signale({ scope: 'sequential-build' });

	// Parse environment variables for selective building
	const architectureFilter = getArchitectureFilter();

	logger.info(
		`Building AppleBlox for macOS${architectureFilter ? ` (${architectureFilter})` : ' (all architectures)'} - Sequential Mode`
	);

	// Clean build directories
	if (!argv.includes('--no-clean')) {
		await $`rm -rf "${resolve('dist')}"`;
		await $`rm -rf "${resolve('.tmpbuild')}"`;
	}

	if (!BuildConfig.mac) {
		logger.fatal('No macOS configuration found in build.config.ts');
		process.exit(1);
	}

	// Build macOS sidecar binaries
	if (!argv.includes('--no-sidecar')) {
		await buildSidecar();
	}

	// Build Vite and Neutralino
	if (!argv.includes('--no-vite')) {
		await buildViteAndNeu(true);
	}

	// Build macOS app bundles
	await macBuild(architectureFilter);

	// Move build artifacts
	await $`rm -rf "${resolve('dist')}"`;
	await $`cp -r "${resolve('.tmpbuild')}" "${resolve('dist')}"`;
	await $`rm -rf "${resolve('.tmpbuild')}"`;

	logger.success(`Sequential macOS build completed in ${((performance.now() - initTime) / 1000).toFixed(3)}s`);

	// Open dist folder
	if (!argv.includes('--no-open')) {
		await $`open ${resolve('./dist')}`;
	}

	process.exit(0);
}

if (import.meta.main) {
	build();
}
