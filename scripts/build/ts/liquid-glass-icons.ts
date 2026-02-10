import { $ } from 'bun';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { Signale } from 'signale';

/**
 * Get the major version of macOS
 * @returns macOS major version number (e.g., 13, 14, 26)
 */
async function getMacOSVersion(): Promise<number> {
	try {
		const result = await $`sw_vers -productVersion`.text();
		const versionString = result.trim();
		const majorVersion = parseInt(versionString.split('.')[0]);

		if (isNaN(majorVersion)) {
			throw new Error(`Failed to parse macOS version: ${versionString}`);
		}

		return majorVersion;
	} catch (error) {
		throw new Error(`Failed to get macOS version: ${error}`);
	}
}

/**
 * Compile .icon bundle to Assets.car using Xcode's actool
 * @param iconBundlePath - Path to .icon bundle directory
 * @param outputDir - Output directory for Assets.car (app's Resources folder)
 */
async function compileAssetCatalog(iconBundlePath: string, outputDir: string): Promise<void> {
	try {
		await $`xcrun actool --compile ${outputDir} --platform macosx --minimum-deployment-target 10.13 --app-icon AppIcon --output-partial-info-plist /dev/null ${iconBundlePath}`;
	} catch (error) {
		throw new Error(`Asset catalog compilation failed: ${error}`);
	}
}

/**
 * Build Liquid Glass icons for macOS 26+
 * Conditionally compiles .icon bundle to Assets.car when running on macOS 26+
 *
 * @param appDist - Path to the app distribution directory
 * @param logger - Logger instance for output
 * @returns true if icons were compiled, false if skipped
 */
export async function buildLiquidGlassIcons(appDist: string, logger: Signale): Promise<boolean> {
	try {
		// Check macOS version
		const macOSVersion = await getMacOSVersion();
		logger.info(`Detected macOS version: ${macOSVersion}`);

		if (macOSVersion < 26) {
			logger.info('macOS < 26 detected, skipping Liquid Glass icon compilation');
			logger.info('Traditional .icns icons will be used as fallback');
			return false;
		}

		// Check if .icon bundle exists
		const iconBundlePath = resolve('scripts/build/assets/liquid-glass/mac.icon');

		if (!existsSync(iconBundlePath)) {
			logger.warn('Liquid Glass icon bundle not found at:', iconBundlePath);
			logger.warn('Skipping Liquid Glass compilation, using traditional icons only');
			return false;
		}

		// Verify it's a directory (not a file)
		const fs = await import('fs/promises');
		const stats = await fs.stat(iconBundlePath);

		if (!stats.isDirectory()) {
			logger.warn('Expected .icon bundle to be a directory, found file instead');
			logger.warn('Skipping Liquid Glass compilation');
			return false;
		}

		// Compile asset catalog
		const resourcesPath = resolve(appDist, 'AppleBlox.app/Contents/Resources');
		logger.info('Compiling Liquid Glass icon bundle...');
		logger.info(`  Source: ${iconBundlePath}`);
		logger.info(`  Output: ${resourcesPath}/Assets.car`);

		await compileAssetCatalog(iconBundlePath, resourcesPath);

		// Verify Assets.car was created
		const assetsCar = resolve(resourcesPath, 'Assets.car');
		if (!existsSync(assetsCar)) {
			throw new Error('Assets.car was not created by actool');
		}

		logger.success('Liquid Glass icon compiled successfully');
		logger.success(`Assets.car size: ${(await fs.stat(assetsCar)).size} bytes`);
		return true;
	} catch (error) {
		// Non-fatal error - log warning and continue
		logger.warn('Failed to compile Liquid Glass icons:', error instanceof Error ? error.message : String(error));
		logger.warn('Build will continue with traditional .icns fallback');
		return false;
	}
}
