// THIS FILE IS IN BETA. PLEASE TELL ME IF ANYTHING LOOKS STRANGE
import BuildConfig from '@root/build.config';
import neuConfig from '@root/neutralino.config.json';
import packageJson from '@root/package.json';
import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Data, NtExecutable, NtExecutableResource, Resource } from 'resedit';
import { Signale } from 'signale';

export async function winBuild() {
	const logger = new Signale();
	if (!BuildConfig.win) {
		logger.fatal('No windows config was found in build.config.js!');
		return;
	}

	const Dist = resolve('.tmpbuild');

	for (const app of BuildConfig.win.architecture) {
		const appTime = performance.now();
		const appDist = resolve(Dist, `win_${app}`);

		await $`mkdir -p "${appDist}"`;

		const l = new Signale({ scope: `build-win-${app}`, interactive: true });
		l.await(`Building win-${app}`);

		const neuResources = resolve('dist', neuConfig.cli.binaryName, 'resources.neu');
		if (!existsSync(neuResources)) {
			l.fatal("No 'resources.neu' file was not found in the ./dist directory");
			return;
		}

		const executable = resolve('dist', neuConfig.cli.binaryName, `${neuConfig.cli.binaryName}-win_${app}.exe`);
		if (!existsSync(executable)) {
			l.fatal(`The '${neuConfig.cli.binaryName}-win_${app}.exe' executable was not found in the ./dist directory`);
			return;
		}

		const data = await Bun.file(executable).bytes();
		const exe = NtExecutable.from(data);
		const res = NtExecutableResource.from(exe);

		const iconData = await Bun.file(BuildConfig.win.appIcon).bytes();
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
			{ lang: 1033, codepage: 1200 },
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
			const resourcesContent = await Bun.file(neuResources).arrayBuffer();
			// @ts-expect-error
			res.entries.push({
				type: 10,
				id: 1000,
				lang: 1033,
				bin: resourcesContent,
			});
		}

		res.outputResource(exe);
		await Bun.write(resolve(appDist, `${BuildConfig.appName}.exe`), Buffer.from(exe.generate()));
		l.complete(
			`win_${app} built in ${((performance.now() - appTime) / 1000).toFixed(3)}s ${BuildConfig.win.embedResources ? '(Embeded Resources)' : ''}`
		);
		console.log('');
	}
}
