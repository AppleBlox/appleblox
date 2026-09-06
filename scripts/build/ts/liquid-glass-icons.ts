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
		await $`xcrun actool --compile ${outputDir} --platform macosx --minimum-deployment-target 26.0 --app-icon AppIcon --output-partial-info-plist /dev/null ${iconBundlePath}`;
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
	const fs = await import('fs/promises');
	const resourcesPath = resolve(appDist, 'AppleBlox.app/Contents/Resources');
	const assetsCar = resolve(resourcesPath, 'Assets.car');
	const iconBundlePath = resolve('scripts/build/assets/liquid-glass/AppIcon.icon');
	const precompiledPath = resolve('scripts/build/assets/liquid-glass/Assets.car');

	try {
		// Check macOS version
		const macOSVersion = await getMacOSVersion();
		logger.info(`Detected macOS version: ${macOSVersion}`);

		if (macOSVersion >= 26) {
			// On macOS 26+, try compiling with actool
			if (!existsSync(iconBundlePath)) {
				logger.warn('Liquid Glass icon bundle not found at:', iconBundlePath);
			} else {
				const stats = await fs.stat(iconBundlePath);
				if (!stats.isDirectory()) {
					logger.warn('Expected .icon bundle to be a directory, found file instead');
				} else {
					// Compile asset catalog
					logger.info('Compiling Liquid Glass icon bundle...');
					logger.info(`  Source: ${iconBundlePath}`);
					logger.info(`  Output: ${resourcesPath}/Assets.car`);

					await compileAssetCatalog(iconBundlePath, resourcesPath);

					if (existsSync(assetsCar)) {
						logger.success('Liquid Glass icon compiled successfully');
						logger.success(`Assets.car size: ${(await fs.stat(assetsCar)).size} bytes`);
						return true;
					}

					logger.warn('Assets.car was not created by actool');
				}
			}
		} else {
			logger.info('macOS < 26 detected, skipping Liquid Glass icon compilation');
		}

		// Fallback: copy pre-compiled Assets.car if available
		if (existsSync(precompiledPath)) {
			logger.info('Using pre-compiled Assets.car fallback');
			await fs.copyFile(precompiledPath, assetsCar);
			logger.success('Pre-compiled Assets.car copied to Resources');
			return true;
		}

		logger.info('No pre-compiled Assets.car found, using traditional .icns icons only');
		return false;
	} catch (error) {
		// Non-fatal: try pre-compiled fallback before giving up
		if (existsSync(precompiledPath) && !existsSync(assetsCar)) {
			try {
				await fs.copyFile(precompiledPath, assetsCar);
				logger.warn('actool failed, used pre-compiled Assets.car fallback');
				return true;
			} catch {
				// Fallback copy also failed
			}
		}

		logger.warn('Failed to compile Liquid Glass icons:', error instanceof Error ? error.message : String(error));
		logger.warn('Build will continue with traditional .icns fallback');
		return false;
	}
}
