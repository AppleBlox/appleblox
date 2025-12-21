import BuildConfig from '@root/build.config';
import { $ } from 'bun';
import { resolve } from 'node:path';
import { Signale } from 'signale';
import { macBuildSingle } from './mac-bundle';
import { buildSidecar } from './sidecar';
import { buildViteAndNeu, filterArchitectures, getArchitectureFilter } from './utils';

const { argv } = process;

async function parallelBuild() {
	const initTime = performance.now();
	const logger = new Signale({ scope: 'parallel-build' });

	if (!BuildConfig.mac) {
		logger.fatal('No macOS configuration found in build.config.ts');
		return;
	}

	// Get architecture filter from environment
	const architectureFilter = getArchitectureFilter();
	const targetArchs = filterArchitectures(BuildConfig.mac.architecture, architectureFilter);

	if (targetArchs.length === 0) {
		logger.fatal(`No valid architectures found for filter: ${architectureFilter}`);
		return;
	}

	logger.info(
		`Starting parallel build for macOS${architectureFilter ? ` (${architectureFilter})` : ` (${targetArchs.join(', ')})`}`
	);

	// Clean directories first
	if (!argv.includes('--no-clean')) {
		await $`rm -rf "${resolve('dist')}"`;
		await $`rm -rf "${resolve('.tmpbuild')}"`;
	}

	await $`mkdir -p "${resolve('.tmpbuild')}"`;

	// Build shared components sequentially (these can't be parallelized)
	logger.await('Building shared components...');
	await buildSidecar();
	await buildViteAndNeu(!argv.includes('--no-vite'));
	logger.success('Shared components built');

	// If only one architecture, build sequentially for better output
	if (targetArchs.length === 1) {
		logger.info(`Building single architecture ${targetArchs[0]} sequentially`);
		await macBuildSingle(targetArchs[0], resolve('.tmpbuild'));
	} else {
		// Run parallel builds for multiple architectures
		logger.info(`Building ${targetArchs.length} architectures in parallel`);

		const buildPromises = targetArchs.map(async (arch) => {
			const archLogger = new Signale({ scope: `build-${arch}`, interactive: false });
			archLogger.await(`Building ${arch} in parallel`);

			try {
				await macBuildSingle(arch, resolve('.tmpbuild'));
				archLogger.success(`${arch} build completed`);
				return { arch, success: true };
			} catch (error) {
				archLogger.fatal(`${arch} build failed: ${error}`);
				return { arch, success: false, error };
			}
		});

		const results = await Promise.allSettled(buildPromises);

		// Check results and report
		const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success);
		const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

		if (failed.length > 0) {
			logger.error(`${failed.length} build(s) failed, ${successful.length} succeeded`);
			process.exit(1);
		}

		logger.success(`All ${successful.length} parallel builds completed successfully`);
	}

	// Move build artifacts
	await $`rm -rf "${resolve('dist')}"`;
	await $`cp -r "${resolve('.tmpbuild')}" "${resolve('dist')}"`;
	await $`rm -rf "${resolve('.tmpbuild')}"`;

	logger.success(`Parallel build completed in ${((performance.now() - initTime) / 1000).toFixed(3)}s`);

	// Open dist folder
	if (!argv.includes('--no-open')) {
		await $`open ${resolve('./dist')}`;
	}
}

if (import.meta.main) {
	parallelBuild().catch((error) => {
		console.error('Build failed:', error);
		process.exit(1);
	});
}
