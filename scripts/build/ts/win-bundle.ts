// THIS FILE IS IN BETA. PLEASE TELL ME IF ANYTHING LOOKS STRANGE
import packageJson from '@root/package.json';
import neuConfig from '@root/neutralino.config.json';
import BuildConfig from '@root/build.config';
import fs from 'fs';
import path from 'path';
import {Signale} from 'signale';
import {NtExecutable, NtExecutableResource, Data, Resource} from 'resedit';

export async function winBuild() {
	const logger = new Signale();
	if (!BuildConfig.win) {
		logger.fatal('No windows config was found in build.config.js!');
		return;
	}

	const Dist = path.resolve('.tmpbuild');

	for (const app of BuildConfig.win.architecture) {
		const appTime = performance.now();
		const appDist = path.resolve(Dist, 'win_' + app);

		fs.mkdirSync(appDist, {recursive: true});

		const l = new Signale({scope: 'build-win-' + app, interactive: true});
		l.await(`Building win-${app}`);

		const neuResources = path.resolve('dist', neuConfig.cli.binaryName, 'resources.neu');
		if (!fs.existsSync(neuResources)) {
			l.fatal("No 'resources.neu' file was not found in the ./dist directory");
			return;
		}

		const executable = path.resolve('dist', neuConfig.cli.binaryName, `${neuConfig.cli.binaryName}-win_${app}.exe`);
		if (!fs.existsSync(executable)) {
			l.fatal(`The '${neuConfig.cli.binaryName}-win_${app}.exe' executable was not found in the ./dist directory`);
			return;
		}

		const data = fs.readFileSync(executable);
		const exe = NtExecutable.from(data);
		const res = NtExecutableResource.from(exe);

		const iconData = fs.readFileSync(BuildConfig.win.appIcon);
		const iconFile = Data.IconFile.from(iconData);
		Resource.IconGroupEntry.replaceIconsForResource(
			res.entries,
			101,
			1033,
			iconFile.icons.map((item) => item.data)
		);

		// Set version
		const vi = Resource.VersionInfo.createEmpty();
		vi.setFileVersion(0, 0, Number(neuConfig.version), 0, 1033);
		vi.setStringValues(
			{lang: 1033, codepage: 1200},
			{
				FileDescription: BuildConfig.description,
				ProductName: BuildConfig.appName,
				ProductVersion: neuConfig.version,
				CompanyName: packageJson.author,
			}
		);
		vi.outputToResourceEntries(res.entries);

		// Embed Resources.neu and config
		if (BuildConfig.win.embedResources) {
			const resourcesContent = fs.readFileSync(neuResources);
			// @ts-expect-error
			res.entries.push({
				type: 10,
				id: 1000,
				lang: 1033,
				bin: resourcesContent,
			})
		}

		res.outputResource(exe);
		fs.writeFileSync(path.resolve(appDist, `${BuildConfig.appName}.exe`), Buffer.from(exe.generate()));
		l.complete(
			`win_${app} built in ${((performance.now() - appTime) / 1000).toFixed(3)}s ${
				BuildConfig.win.embedResources ? '(Embeded Resources)' : ''
			}`
		);
		console.log('');
	}
}
