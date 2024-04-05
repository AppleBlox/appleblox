import neuConfig from '@root/neutralino.config.json';
import BuildConfig from '@root/build.config';
import fs from 'fs';
import path from 'path';
import {Signale} from 'signale';
import {copyFolderSync} from './utils';

export async function macBuild() {
	const logger = new Signale();
	if (!BuildConfig.mac) {
		logger.fatal('No mac config was found in build.config.js!');
		return;
	}

	const Dist = path.resolve('.tmpbuild');
	const Libraries = path.resolve('build/lib/MacOS');

	for (const app of BuildConfig.mac.architecture) {
		const appTime = performance.now();
		const appDist = path.resolve(Dist, 'mac_' + app);

		const l = new Signale({scope: 'build-mac-' + app, interactive: true});
		l.await(`Building mac-${app}`);

		const neuResources = path.resolve('dist', neuConfig.cli.binaryName, 'resources.neu');
		if (!fs.existsSync(neuResources)) {
			l.fatal("No 'resources.neu' file was not found in the ./dist directory");
			return;
		}

		const executable = path.resolve('dist', neuConfig.cli.binaryName, `${neuConfig.cli.binaryName}-mac_${app}`);
		if (!fs.existsSync(executable)) {
			l.fatal(`The '${neuConfig.cli.binaryName}-mac_${app}' executable was not found in the ./dist directory`);
			return;
		}

		// Directory Structure
		const Contents = path.resolve(appDist, `${BuildConfig.appName}.app/Contents`);
		fs.mkdirSync(Contents, {recursive: true});
		const MacOS = path.resolve(Contents, 'MacOS');
		fs.mkdirSync(MacOS);
		const Resources = path.resolve(Contents, 'Resources');
		fs.mkdirSync(Resources);

		// Plist
		const InfoPlist = path.resolve(Contents, 'Info.plist');
		const InfoPlistTemplate = fs
			.readFileSync(path.resolve(__dirname, '../templates/mac/Info.plist'), 'utf-8')
			.replaceAll('{APP_NAME}', BuildConfig.appName)
			.replaceAll('{APP_ID}', neuConfig.applicationId)
			.replaceAll('{APP_BUNDLE}', BuildConfig.appBundleName)
			.replaceAll('{APP_MIN_OS}', BuildConfig.mac.minimumOS)
			.replaceAll('{APP_VERSION}', neuConfig.version);
		fs.writeFileSync(InfoPlist, InfoPlistTemplate);

		// Executables
		fs.copyFileSync(executable, path.resolve(MacOS, 'main'));
		fs.chmodSync(path.resolve(MacOS, 'main'), '755');
		fs.copyFileSync(path.resolve(__dirname, '../templates/mac/bootstrap'), path.resolve(MacOS, 'bootstrap'));
		fs.chmodSync(path.resolve(MacOS, 'bootstrap'), '755');

		// Resources
		fs.copyFileSync(neuResources, path.resolve(Resources, 'resources.neu'));

		// Assets
		fs.copyFileSync(BuildConfig.mac.appIcon, path.resolve(Resources, 'icon.icns'));

		// Libraries
		if (fs.existsSync(Libraries)) {
			copyFolderSync(Libraries, path.resolve(Resources, 'lib'));
		}
		l.complete(`mac_${app} built in ${((performance.now() - appTime) / 1000).toFixed(3)}s`);
		console.log("")
	}
}
