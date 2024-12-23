import BuildConfig from '@root/build.config';
import { $ } from 'bun';
import { resolve } from 'node:path';
import { Signale } from 'signale';
import { linuxBuild } from './linux-bundle';
import { macBuild } from './mac-bundle';
import { buildSidecar } from './sidecar';
import { buildViteAndNeu } from './utils';
import { winBuild } from './win-bundle';

const { argv } = process;

export async function build() {
	$.cwd(process.cwd());
	const initTime = performance.now();
	const logger = new Signale();
	await $`rm -rf "${resolve('dist')}"`;
	await $`rm -rf "${resolve('.tmpbuild')}"`;

	if (!BuildConfig.mac && !BuildConfig.win && !BuildConfig.linux) {
		console.log('Skipping build, no target set in build.config.ts.');
		return;
	}

	await buildSidecar();
	await buildViteAndNeu(!argv.includes('--no-vite'));

	if (BuildConfig.mac) {
		await macBuild();
	}
	if (BuildConfig.win) {
		await winBuild();
	}
	if (BuildConfig.linux) {
		await linuxBuild();
	}

	await $`rm -rf "${resolve('dist')}"`;
	await $`cp -r "${resolve('.tmpbuild')}" "${resolve('dist')}"`;
	await $`rm -rf "${resolve('.tmpbuild')}"`;
	logger.success(`Built in ${((performance.now() - initTime) / 1000).toFixed(3)}s`);
	switch (process.platform) {
		case 'linux':
		case 'darwin':
			await $`open ${resolve('./dist')}`;
			break;
		case 'win32':
			await $`start ${resolve('./dist')}`;
			break;
	}
	process.exit(0);
}

build();
