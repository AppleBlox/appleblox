import BuildConfig from '@root/build.config';
import neuConfig from '@root/neutralino.config.json';
import { version } from '@root/package.json';
import { $, sleep } from 'bun';
import { chmodSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Signale } from 'signale';
import { buildLiquidGlassIcons } from './liquid-glass-icons';
import {
	copyWithProgress,
	createProgressLogger,
	ensureDirectory,
	executeWithRetry,
	filterArchitectures,
	getMacExecutableArchs,
	validateMacExecutable,
} from './utils';

export async function macBuild(architectureFilter?: string | null) {
	const logger = new Signale({ scope: 'mac-build' });

	if (!BuildConfig.mac) {
		logger.fatal('No macOS configuration found in build.config.ts');
		return;
	}

	// Filter architectures based on environment variable
	const targetArchs = filterArchitectures(BuildConfig.mac.architecture, architectureFilter);

	if (targetArchs.length === 0) {
		logger.warn(`No valid architectures found for filter: ${architectureFilter}`);
		return;
	}

	logger.info(`Building macOS app bundles for: ${targetArchs.join(', ')}`);

	await sleep(1000);
	const Dist = resolve('.tmpbuild');

	// Build each architecture in sequence for stability
	for (const arch of targetArchs) {
		await macBuildSingle(arch, Dist);
	}

	logger.success(`macOS build completed for ${targetArchs.length} architecture(s)`);
}

export async function macBuildSingle(arch: string, distPath: string) {
	const appTime = performance.now();
	const appDist = resolve(distPath, `mac_${arch}`);
	const logger = createProgressLogger(`mac-${arch}`);
	const Libraries = resolve('bin');
	const LibrariesBlacklist = ['bootstrap', 'neutralino'];

	logger.await(`Building macOS app bundle for ${arch}`);

	// Validate required files
	const requiredFiles = await validateRequiredFiles(arch, logger);
	if (!requiredFiles) {
		throw new Error(`Required files not found for ${arch}`);
	}

	const { neuResources, executable } = requiredFiles;

	try {
		// Validate executable architecture
		if (!(await validateMacExecutable(executable))) {
			logger.fatal(`Invalid macOS executable: ${executable}`);
			throw new Error(`Invalid executable for ${arch}`);
		}

		const execArchs = await getMacExecutableArchs(executable);
		logger.info(`Executable architectures: ${execArchs.join(', ')}`);

		// Create directory structure
		await createAppDirectoryStructure(appDist, logger);

		// Generate and write Info.plist
		await generateInfoPlist(appDist, logger);

		// Copy executables with proper permissions
		await copyExecutables(appDist, executable, logger);

		// Copy resources
		await copyResources(appDist, neuResources, logger);

		// Copy assets
		await copyAssets(appDist, logger);

		// Bundle icons
		await bundleIcons(appDist, logger);

		// Build Liquid Glass icons (macOS 26+ only)
		try {
			const liquidGlassCompiled = await buildLiquidGlassIcons(appDist, logger);
			if (liquidGlassCompiled) {
				logger.success('✓ Liquid Glass icon support added');
			}
		} catch (error) {
			logger.warn('Liquid Glass icon compilation skipped:', error instanceof Error ? error.message : String(error));
		}

		// Handle libraries
		await handleLibraries(appDist, Libraries, LibrariesBlacklist, logger);

		// Verify app bundle structure
		await verifyAppBundle(appDist, logger);

		logger.complete(`mac_${arch} built in ${((performance.now() - appTime) / 1000).toFixed(3)}s`);
	} catch (error) {
		logger.fatal(`Failed to build mac_${arch}: ${error}`);
		throw error;
	}
}

async function validateRequiredFiles(arch: string, logger: Signale) {
	const neuResources = resolve('dist', neuConfig.cli.binaryName, 'resources.neu');
	const executable = resolve('dist', neuConfig.cli.binaryName, `${neuConfig.cli.binaryName}-mac_${arch}`);

	if (!existsSync(neuResources)) {
		logger.fatal("'resources.neu' file not found in ./dist directory");
		return null;
	}

	if (!existsSync(executable)) {
		logger.fatal(`Executable '${neuConfig.cli.binaryName}-mac_${arch}' not found in ./dist directory`);
		return null;
	}

	return { neuResources, executable };
}

async function createAppDirectoryStructure(appDist: string, logger: Signale) {
	const appBundle = `${BuildConfig.appName}.app`;
	const Contents = resolve(appDist, appBundle, 'Contents');
	const MacOS = resolve(Contents, 'MacOS');
	const Resources = resolve(Contents, 'Resources');

	await ensureDirectory(Contents);
	await ensureDirectory(MacOS);
	await ensureDirectory(Resources);

	logger.success('Created app bundle directory structure');
}

async function generateInfoPlist(appDist: string, logger: Signale) {
	const appBundle = `${BuildConfig.appName}.app`;
	const InfoPlist = resolve(appDist, appBundle, 'Contents', 'Info.plist');

	if (!BuildConfig.mac) {
		throw new Error('macOS config not found');
	}

	const copyright = BuildConfig.copyright || `Copyright © ${new Date().getFullYear()} ${BuildConfig.appName}`;
	const urlSchemeName = `${BuildConfig.appName} URL Scheme`;

	const InfoPlistTemplate = (await Bun.file(resolve(__dirname, '../templates/mac/Info.plist')).text())
		.replace(/{APP_NAME}/g, BuildConfig.appName)
		.replace(/{APP_ID}/g, neuConfig.applicationId)
		.replace(/{APP_BUNDLE}/g, BuildConfig.appBundleName)
		.replace(/{APP_MIN_OS}/g, BuildConfig.mac.minimumOS)
		.replace(/{APP_VERSION}/g, version)
		.replace(/{APP_COPYRIGHT}/g, copyright)
		.replace(/{APP_URL_SCHEME_NAME}/g, urlSchemeName);

	await Bun.write(InfoPlist, InfoPlistTemplate);
	logger.success('Generated Info.plist');
}

async function copyExecutables(appDist: string, executable: string, logger: Signale) {
	const appBundle = `${BuildConfig.appName}.app`;
	const MacOS = resolve(appDist, appBundle, 'Contents', 'MacOS');
	const mainPath = resolve(MacOS, 'main');
	const bootstrapPath = resolve(MacOS, 'bootstrap');
	const bootstrapSource = resolve('bin/bootstrap_ablox');

	// Copy main executable with retry
	await executeWithRetry(
		async () => {
			await $`cp "${executable}" "${mainPath}"`;
		},
		3,
		1000
	);
	chmodSync(mainPath, '755');
	logger.success('Copied main executable');

	// Copy bootstrap executable
	if (existsSync(bootstrapSource)) {
		await executeWithRetry(
			async () => {
				await $`cp "${bootstrapSource}" "${bootstrapPath}"`;
			},
			3,
			1000
		);
		chmodSync(bootstrapPath, '755');
		logger.success('Copied bootstrap executable');
	} else {
		logger.warn('Bootstrap executable not found, skipping');
	}
}

async function copyResources(appDist: string, neuResources: string, logger: Signale) {
	const appBundle = `${BuildConfig.appName}.app`;
	const Resources = resolve(appDist, appBundle, 'Contents', 'Resources');

	await copyWithProgress(neuResources, resolve(Resources, 'resources.neu'), logger);
}

async function copyAssets(appDist: string, logger: Signale) {
	if (!BuildConfig.mac?.appIcon) {
		logger.warn('No app icon specified, skipping');
		return;
	}

	const appBundle = `${BuildConfig.appName}.app`;
	const Resources = resolve(appDist, appBundle, 'Contents', 'Resources');

	if (existsSync(BuildConfig.mac.appIcon)) {
		await copyWithProgress(BuildConfig.mac.appIcon, resolve(Resources, 'icon.icns'), logger);
	} else {
		logger.warn(`App icon not found at ${BuildConfig.mac.appIcon}`);
	}
}

async function bundleIcons(appDist: string, logger: Signale) {
	const bundledIconsPath = resolve('scripts/build/assets/bundled-icons');

	if (!existsSync(bundledIconsPath)) {
		logger.info('No bundled-icons directory found, skipping');
		return;
	}

	const appBundle = `${BuildConfig.appName}.app`;
	const Resources = resolve(appDist, appBundle, 'Contents', 'Resources');
	const bundledIconsDestPath = resolve(Resources, 'bundled-icons');

	try {
		// Get list of .icns files
		const icnsFiles = await $`find ${bundledIconsPath} -name "*.icns" -type f`.text();
		const files = icnsFiles
			.trim()
			.split('\n')
			.filter((f) => f);

		if (files.length === 0) {
			logger.info('No .icns files found in bundled-icons directory');
			return;
		}

		// Create destination directory
		await ensureDirectory(bundledIconsDestPath);

		// Gzip each icon and copy to Resources
		for (const file of files) {
			const fileName = file.split('/').pop();
			if (!fileName) continue;

			const gzippedName = `${fileName}.gz`;
			const destPath = resolve(bundledIconsDestPath, gzippedName);

			// Gzip the file
			await $`gzip -c ${file} > ${destPath}`;
			logger.info(`Bundled icon: ${fileName} (gzipped)`);
		}

		logger.success(`Bundled ${files.length} icon(s)`);
	} catch (error) {
		logger.warn('Failed to bundle icons:', error);
	}
}

async function handleLibraries(appDist: string, librariesPath: string, librariesBlacklist: string[], logger: Signale) {
	if (!existsSync(librariesPath)) {
		logger.info('No libraries directory found, skipping');
		return;
	}

	const appBundle = `${BuildConfig.appName}.app`;
	const Resources = resolve(appDist, appBundle, 'Contents', 'Resources');
	const libPath = resolve(Resources, 'lib');

	// Copy libraries
	await copyWithProgress(librariesPath, libPath, logger);

	// Remove blacklisted files (bootstrap_ablox and neutralino binaries)
	try {
		const blacklistPattern = librariesBlacklist.map((pattern) => `${pattern}_ablox|${pattern}`).join('|');
		const files = (await $`ls ${librariesPath} | grep -E '${blacklistPattern}'`.text()).split('\n');
		files.pop(); // Remove empty last element

		for (const file of files) {
			if (file.trim()) {
				await $`rm -rf "${join(libPath, file.trim())}"`;
			}
		}

		logger.success('Processed libraries');
	} catch (error) {
		logger.info('No blacklisted files found or libraries processed successfully');
	}
}

async function verifyAppBundle(appDist: string, logger: Signale) {
	const appBundle = `${BuildConfig.appName}.app`;
	const appPath = resolve(appDist, appBundle);

	// Check if app bundle exists
	if (!existsSync(appPath)) {
		throw new Error('App bundle was not created');
	}

	// Check essential files
	const essentialFiles = ['Contents/Info.plist', 'Contents/MacOS/main', 'Contents/Resources/resources.neu'];

	for (const file of essentialFiles) {
		const filePath = resolve(appPath, file);
		if (!existsSync(filePath)) {
			throw new Error(`Essential file missing: ${file}`);
		}
	}

	logger.success('App bundle verification passed');
}
