import BuildConfig from '@root/build.config';
import child_process from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Signale } from 'signale';
import { version } from '../../../package.json';

interface DmgOptions {
	sourceFolder: string;
	outputName: string;
	volumeName?: string;
	backgroundPath?: string;
	windowPos?: string;
	windowSize?: string;
	textSize?: number;
	iconSize?: number;
	iconPos?: string;
	appDropLink?: string;
}

async function createCustomDMG(options: DmgOptions) {
	const guidePath = resolve(join("scripts/build/assets","Install Guide.rtf"))
	const {
		sourceFolder,
		outputName,
		volumeName,
		backgroundPath,
		windowPos,
		windowSize,
		textSize,
		iconSize,
		iconPos,
		appDropLink,
	} = options;

	// Prepare command arguments
	const args = [
		'create-dmg',
		`--volname "${volumeName || outputName}"`,
		`--background "${backgroundPath}"`,
		`--window-pos ${windowPos || '200 120'}`, // Default to '200 120' if not provided
		`--window-size ${windowSize || '800 400'}`, // Default to '800 400' if not provided
		`--text-size ${textSize || 12}`, // Default to 12 if not provided
		`--icon-size ${iconSize || 100}`, // Default to 100
		iconPos ? `--icon "${BuildConfig.appName}.app" ${iconPos}` : '', // Icon position (left, y centered)
		`--add-file "Install Guide.rtf" "${guidePath}" 300 40`,
		`--app-drop-link ${appDropLink || '600 120'}`, // Default to '600 120' (right side) if not provided
		`"${outputName}.dmg"`,
		`"${sourceFolder}"`,
	];
	try {
		await new Promise<void>((resolve, reject) => {
			child_process.exec(args.join(' '), (error, stdout, stderr) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
		console.log('DMG created successfully');
	} catch (error) {
		console.error('Failed to create DMG:', error);
		console.error(error);
		throw new Error(`Failed to create dmg:\n${error}`);
	}
}

async function build() {
	const logger = new Signale();
	if (!BuildConfig.mac) {
		logger.fatal('No mac config was found in build.config.js!');
		return;
	}

	for (const app of BuildConfig.mac.architecture) {
		const appTime = performance.now();

		const l = new Signale({ scope: `build-mac-${app}`, interactive: true });
		l.await(`Packaging mac-${app}`);

		const appFolder = resolve(`./dist/mac_${app}/${BuildConfig.appName}.app`);
		if (!existsSync(appFolder)) {
			l.fatal(`The '${appFolder}' app bundle was not found in the ./dist directory`);
			return;
		}

		try {
			await createCustomDMG({
				sourceFolder: appFolder,
				outputName: join(resolve('./dist'), `${BuildConfig.appName}-${version}_${app}`),
				volumeName: BuildConfig.appName,
				backgroundPath: resolve('./scripts/build/assets/bg.png'),
				windowPos: '200 120',
				windowSize: '600 360',
				iconSize: 90,
				iconPos: '160 180',
				appDropLink: '440 180',
			});
		} catch (err) {
			l.fatal(`failed to package mac_${app}, skipping.`);
			continue;
		}

		l.complete(`mac_${app} packaged in ${((performance.now() - appTime) / 1000).toFixed(3)}s`);
		console.log('');
	}
}

build();
