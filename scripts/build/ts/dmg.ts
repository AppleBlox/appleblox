import BuildConfig from '@root/build.config';
import child_process from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Signale } from 'signale';
import { version } from '../../../package.json';
import { getArchitectureFilter, filterArchitectures } from './utils';

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
	const guidePath = resolve(join('scripts/build/assets', 'Install Guide.rtf'));
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
		backgroundPath ? `--background "${backgroundPath}"` : '',
		`--window-pos ${windowPos || '200 120'}`,
		`--window-size ${windowSize || '800 400'}`,
		`--text-size ${textSize || 12}`,
		`--icon-size ${iconSize || 100}`,
		iconPos ? `--icon "${BuildConfig.appName}.app" ${iconPos}` : '',
		existsSync(guidePath) ? `--add-file "Install Guide.rtf" "${guidePath}" 300 40` : '',
		`--app-drop-link ${appDropLink || '600 120'}`,
		`"${outputName}.dmg"`,
		`"${sourceFolder}"`,
	].filter(arg => arg !== ''); // Remove empty arguments

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
		throw new Error(`Failed to create DMG:\n${error}`);
	}
}

async function build() {
	const logger = new Signale({ scope: 'dmg-builder' });
	
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

	logger.info(`Creating DMG files for architectures: ${targetArchs.join(', ')}`);

	// Create DMGs in parallel for multiple architectures
	const dmgPromises = targetArchs.map(async (arch) => {
		const appTime = performance.now();
		const archLogger = new Signale({ scope: `dmg-${arch}`, interactive: false });
		
		archLogger.await(`Creating DMG for ${arch}`);

		const appFolder = resolve(`./dist/mac_${arch}/${BuildConfig.appName}.app`);
		
		if (!existsSync(appFolder)) {
			archLogger.fatal(`App bundle not found: ${appFolder}`);
			throw new Error(`App bundle not found for ${arch}`);
		}

		// Verify app bundle is valid
		const infoPlistPath = resolve(appFolder, 'Contents/Info.plist');
		const mainExecutablePath = resolve(appFolder, 'Contents/MacOS/main');
		
		if (!existsSync(infoPlistPath) || !existsSync(mainExecutablePath)) {
			archLogger.fatal(`Invalid app bundle: ${appFolder}`);
			throw new Error(`Invalid app bundle for ${arch}`);
		}

		try {
			const dmgName = `${BuildConfig.appName}-${version}_${arch}`;
			const dmgOutput = join(resolve('./dist'), dmgName);
			
			await createCustomDMG({
				sourceFolder: resolve(`./dist/mac_${arch}`),
				outputName: dmgOutput,
				volumeName: BuildConfig.appName,
				backgroundPath: existsSync(resolve('./scripts/build/assets/bg.png')) 
					? resolve('./scripts/build/assets/bg.png') 
					: undefined,
				windowPos: '200 120',
				windowSize: '600 360',
				iconSize: 90,
				iconPos: '160 180',
				appDropLink: '440 180',
			});

			archLogger.complete(`DMG for ${arch} created in ${((performance.now() - appTime) / 1000).toFixed(3)}s`);
			return { arch, success: true };
			
		} catch (err) {
			archLogger.fatal(`Failed to create DMG for ${arch}: ${err}`);
			return { arch, success: false, error: err };
		}
	});

	// Wait for all DMG creations to complete
	const results = await Promise.allSettled(dmgPromises);
	
	// Check results
	const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
	const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
	
	if (failed.length > 0) {
		logger.error(`${failed.length} DMG creation(s) failed, ${successful.length} succeeded`);
		process.exit(1);
	}
	
	logger.success(`DMG creation completed for ${successful.length} architecture(s)`);
}

if (import.meta.main) {
	build();
}