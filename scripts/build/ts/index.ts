import BuildConfig from '@root/build.config';
import {macBuild} from './mac-bundle';
import {buildBinaries, copyFolderSync} from './utils';
import path from 'path';
import fs from 'fs';
import {winBuild} from './win-bundle';
import {Signale} from 'signale';
import {linuxBuild} from './linux-bundle';
import { exec } from "child_process"

export async function build() {
	const initTime = performance.now();
	const logger = new Signale();
	fs.rmSync(path.resolve('dist'), {recursive: true, force: true});
	fs.rmSync(path.resolve('.tmpbuild'), {recursive: true, force: true});

	if (!BuildConfig.mac && !BuildConfig.win && !BuildConfig.linux) {
		console.log('Skipping build, no target set in build.config.ts.');
		return;
	}

	await buildBinaries();

	if (BuildConfig.mac) {
		await macBuild();
	}
	if (BuildConfig.win) {
		await winBuild();
	}
	if (BuildConfig.linux) {
		await linuxBuild();
	}

	fs.rmSync(path.resolve('dist'), {recursive: true, force: true});
	copyFolderSync(path.resolve('.tmpbuild'), path.resolve('./dist'));
	fs.rmSync(path.resolve('.tmpbuild'), {recursive: true, force: true});
	logger.success(`Built in ${((performance.now() - initTime) / 1000).toFixed(3)}s`);
	switch (process.platform) {
		case "linux":
		case "darwin":
			exec(`open ${path.resolve("./dist")}`);
			break;
		case "win32":
			exec(`start ${path.resolve("./dist")}`);
			break;
	}
}

build();
