// THIS FILE IS IN BETA. PLEASE TELL ME IF ANYTHING LOOKS STRANGE
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import BuildConfig from '@root/build.config';
import neuConfig from '@root/neutralino.config.json';
import { Signale } from 'signale';
import { c } from 'tar';
import { $ } from 'bun';

export async function linuxBuild() {
	const logger = new Signale();
	if (!BuildConfig.linux) {
		logger.fatal('No linux config was found in build.config.js!');
		return;
	}

	const Dist = resolve('.tmpbuild');
	const Libraries = resolve('build/lib/Linux');

	for (const app of BuildConfig.linux.architecture) {
		const appTime = performance.now();
		const appDist = resolve(Dist, `linux_${app}`, BuildConfig.appBundleName);
		await $`mkdir -p "${appDist}"`;
		const zipDir = resolve(appDist, 'zip');
		await $`mkdir -p ${zipDir}`;

		const l = new Signale({ scope: `build-linux_${app}`, interactive: true });
		l.await(`Building linux-${app}`);

		const neuResources = resolve('dist', neuConfig.cli.binaryName, 'resources.neu');
		if (!existsSync(neuResources)) {
			l.fatal("No 'resources.neu' file was not found in the ./dist directory");
			return;
		}

		const executable = resolve('dist', neuConfig.cli.binaryName, `${neuConfig.cli.binaryName}-linux_${app}`);
		if (!existsSync(executable)) {
			l.fatal(`The '${neuConfig.cli.binaryName}-linux_${app}' executable was not found in the ./dist directory`);
			return;
		}

		// Installer
		const InstallScript = resolve(appDist, 'install.sh');
		const InstallTemplate = (await Bun.file(resolve(__dirname, '../templates/linux/install.sh')).text())
			.replaceAll('{APP_NAME}', BuildConfig.appName)
			.replaceAll('{APP_PATH}', BuildConfig.linux.appPath)
			.replaceAll('{APP_BUNDLE}', BuildConfig.appBundleName);
		await Bun.write(InstallScript, InstallTemplate);

		// Desktop file
		const DesktopFile = resolve(zipDir, `${BuildConfig.appBundleName}.desktop`);
		const DesktopTemplate = (await Bun.file(resolve(__dirname, '../templates/linux/app.desktop')).text())
			.replaceAll('{APP_VERSION}', neuConfig.version)
			.replaceAll('{APP_NAME}', BuildConfig.appName)
			.replaceAll('{APP_PATH}', BuildConfig.linux.appPath)
			.replaceAll('{APP_ICON_PATH}', join(BuildConfig.linux.appPath, 'appIcon.png'))
			.replaceAll('{APP_EXEC}', join(BuildConfig.linux.appPath, 'neu_main'));
		await Bun.write(DesktopFile,DesktopTemplate)

		// Resources
		await $`cp "${neuResources}" "${resolve(zipDir, 'resources.neu')}"`
		await $`cp "${BuildConfig.linux.appIcon}" "${resolve(zipDir, 'appIcon.png')}"`
		await $`cp "${resolve('./neutralino.config.json')}" "${resolve(zipDir, 'neutralino.config.json')}"`

		// Libraries
		if (existsSync(Libraries)) {
			await $`cp -r "${Libraries}" "${zipDir}"`
		}

		// Executables

		await $`cp "${executable}" "${resolve(zipDir, 'neu_main')}"`

		// Zip
		await c({ gzip: true, file: join(appDist, `${BuildConfig.appName}.tgz`), cwd: zipDir }, ['.']);
		await $`rm -rf "${zipDir}"`

		l.complete(`linux_${app} built in ${((performance.now() - appTime) / 1000).toFixed(3)}s`);
		console.log('');
	}
}
