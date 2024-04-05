// THIS FILE IS IN BETA. PLEASE TELL ME IF ANYTHING LOOKS STRANGE
import neuConfig from '@root/neutralino.config.json';
import BuildConfig from '@root/build.config';
import fs from 'fs';
import path from 'path';
import {Signale} from 'signale';
import {c} from 'tar';
import {copyFolderSync} from './utils';

export async function linuxBuild() {
	const logger = new Signale();
	if (!BuildConfig.linux) {
		logger.fatal('No linux config was found in build.config.js!');
		return;
	}

	const Dist = path.resolve('.tmpbuild');
	const Libraries = path.resolve('build/lib/Linux');

	for (const app of BuildConfig.linux.architecture) {
		const appTime = performance.now();
		const appDist = path.resolve(Dist, 'linux_' + app, BuildConfig.appBundleName);
		fs.mkdirSync(appDist, {recursive: true});
		const zipDir = path.resolve(appDist, 'zip');
		fs.mkdirSync(zipDir);

		const l = new Signale({scope: 'build-linux_' + app, interactive: true});
		l.await(`Building linux-${app}`);

		const neuResources = path.resolve('dist', neuConfig.cli.binaryName, 'resources.neu');
		if (!fs.existsSync(neuResources)) {
			l.fatal("No 'resources.neu' file was not found in the ./dist directory");
			return;
		}

		const executable = path.resolve('dist', neuConfig.cli.binaryName, `${neuConfig.cli.binaryName}-linux_${app}`);
		if (!fs.existsSync(executable)) {
			l.fatal(`The '${neuConfig.cli.binaryName}-linux_${app}' executable was not found in the ./dist directory`);
			return;
		}

		// Installer
		const InstallScript = path.resolve(appDist, 'install.sh');
		const InstallTemplate = fs
			.readFileSync(path.resolve(__dirname, '../templates/linux/install.sh'), 'utf-8')
			.replaceAll('{APP_NAME}', BuildConfig.appName)
			.replaceAll('{APP_PATH}', BuildConfig.linux.appPath)
			.replaceAll('{APP_BUNDLE}', BuildConfig.appBundleName);
		fs.writeFileSync(InstallScript, InstallTemplate);

		// Desktop file
		const DesktopFile = path.resolve(zipDir, BuildConfig.appBundleName + '.desktop');
		const DesktopTemplate = fs
			.readFileSync(path.resolve(__dirname, '../templates/linux/app.desktop'), 'utf-8')
			.replaceAll('{APP_VERSION}', neuConfig.version)
			.replaceAll('{APP_NAME}', BuildConfig.appName)
			.replaceAll('{APP_PATH}', BuildConfig.linux.appPath)
			.replaceAll('{APP_ICON_PATH}', path.join(BuildConfig.linux.appPath, 'appIcon.png'))
			.replaceAll('{APP_EXEC}', path.join(BuildConfig.linux.appPath, 'neu_main'));
		fs.writeFileSync(DesktopFile, DesktopTemplate);

		// Resources
		fs.copyFileSync(neuResources, path.resolve(zipDir, 'resources.neu'));
		fs.copyFileSync(BuildConfig.linux.appIcon, path.resolve(zipDir, 'appIcon.png'));
		fs.copyFileSync(path.resolve('./neutralino.config.json'), path.resolve(zipDir, 'neutralino.config.json'));

		// Libraries
		if (fs.existsSync(Libraries)) {
			copyFolderSync(Libraries, zipDir);
		}

		// Executables
		fs.copyFileSync(executable, path.resolve(zipDir, 'neu_main'));

		// Zip
		await c({gzip: true, file: path.join(appDist, BuildConfig.appName + '.tgz'), cwd: zipDir}, ['.']);
		fs.rmSync(zipDir, {recursive: true});

		l.complete(`linux_${app} built in ${((performance.now() - appTime) / 1000).toFixed(3)}s`);
		console.log('');
	}
}
