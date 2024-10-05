import BuildConfig from '@root/build.config';
import neuConfig from '@root/neutralino.config.json';
import { version } from '@root/package.json';
import { $ } from 'bun';
import { chmodSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Signale } from 'signale';

export async function macBuild() {
	const logger = new Signale();
	if (!BuildConfig.mac) {
		logger.fatal('No mac config was found in build.config.js!');
		return;
	}

	const Dist = resolve('.tmpbuild');
	const Libraries = resolve('bin');
	const LibrariesBlacklist = ['bootstrap', 'neutralino'];

	for (const app of BuildConfig.mac.architecture) {
		const appTime = performance.now();
		const appDist = resolve(Dist, `mac_${app}`);

		const l = new Signale({ scope: `build-mac-${app}`, interactive: true });
		l.await(`Building mac-${app}`);

		const neuResources = resolve('dist', neuConfig.cli.binaryName, 'resources.neu');
		if (!existsSync(neuResources)) {
			l.fatal("No 'resources.neu' file was not found in the ./dist directory");
			return;
		}

		const executable = resolve('dist', neuConfig.cli.binaryName, `${neuConfig.cli.binaryName}-mac_${app}`);
		if (!existsSync(executable)) {
			l.fatal(`The '${neuConfig.cli.binaryName}-mac_${app}' executable was not found in the ./dist directory`);
			return;
		}

		// Directory Structure
		const Contents = resolve(appDist, `${BuildConfig.appName}.app/Contents`);
		await $`mkdir -p "${Contents}"`;
		const MacOS = resolve(Contents, 'MacOS');
		await $`mkdir -p "${MacOS}"`;
		const Resources = resolve(Contents, 'Resources');
		await $`mkdir -p "${Resources}"`;

		// Plist
		const InfoPlist = resolve(Contents, 'Info.plist');
		const InfoPlistTemplate = (await Bun.file(resolve(__dirname, '../templates/mac/Info.plist')).text())
			.replaceAll('{APP_NAME}', BuildConfig.appName)
			.replaceAll('{APP_ID}', neuConfig.applicationId)
			.replaceAll('{APP_BUNDLE}', BuildConfig.appBundleName)
			.replaceAll('{APP_MIN_OS}', BuildConfig.mac.minimumOS)
			.replaceAll('{APP_VERSION}', version);
		await Bun.write(InfoPlist, InfoPlistTemplate);

		// Executables
		await $`cp "${executable}" "${resolve(MacOS, 'main')}"`;
		chmodSync(resolve(MacOS, 'main'), '755');
		await $`cp "${resolve('bin/bootstrap')}" "${resolve(MacOS, 'bootstrap')}"`;
		chmodSync(resolve(MacOS, 'bootstrap'), '755');

		// Resources
		await $`cp "${neuResources}" "${resolve(Resources, 'resources.neu')}"`;

		// Assets
		await $`cp "${BuildConfig.mac.appIcon}" "${resolve(Resources, 'icon.icns')}"`;

		// Libraries
		if (existsSync(Libraries)) {
			const files = (await $`ls ./bin | grep -E '${LibrariesBlacklist.join('|')}'`.text()).split('\n');
			files.pop();
			await $`cp -r "${Libraries}" "${resolve(Resources, 'lib')}"`;
			for (const file of files) {
				await $`rm -rf "${join(Resources, "lib", file)}"`;
			}
		}
		l.complete(`mac_${app} built in ${((performance.now() - appTime) / 1000).toFixed(3)}s`);
		console.log('');
	}
}
