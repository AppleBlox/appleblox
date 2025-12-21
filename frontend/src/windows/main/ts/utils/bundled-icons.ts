import Logger from './logger';
import { getDataDir } from './paths';
import { shell } from '../tools/shell';
import * as shellfs from '../tools/shellfs';

/**
 * Check if we're running in production mode (from app bundle)
 */
function isProductionMode(): boolean {
	return window.NL_PATH.includes('.app/Contents/Resources');
}

/**
 * Extract bundled icons to the user's icons directory
 * This runs on app launch and extracts gzipped .icns files that were bundled with the app
 */
export async function extractBundledIcons(): Promise<void> {
	try {
		// Only extract in production mode
		if (!isProductionMode()) {
			Logger.info('Not in production mode, skipping bundled icon extraction');
			return;
		}

		const bundledIconsPath = `${window.NL_PATH}/bundled-icons`;

		const bundledIconsExist = await shellfs.exists(bundledIconsPath);
		if (!bundledIconsExist) {
			Logger.info('No bundled icons found in app bundle');
			return;
		}

		const dataDir = await getDataDir();
		const iconsDir = `${dataDir}/icons`;
		await shellfs.createDirectory(iconsDir);

		// List all .gz files in bundled-icons
		try {
			const result = await shell('ls', [bundledIconsPath], { skipStderrCheck: true });
			if (!result.stdOut) {
				Logger.info('No bundled icons to extract');
				return;
			}

			const files = result.stdOut.trim().split('\n');
			let extractedCount = 0;
			const bundledIconNames: string[] = [];

			for (const file of files) {
				if (!file.endsWith('.icns.gz')) continue;

				const gzippedPath = `${bundledIconsPath}/${file}`;
				const iconName = file.replace('.gz', ''); // Remove .gz extension
				const destPath = `${iconsDir}/${iconName}`;

				bundledIconNames.push(iconName);

				// Check if icon already exists
				const alreadyExists = await shellfs.exists(destPath);
				if (alreadyExists) {
					Logger.info(`Bundled icon already extracted: ${iconName}`);
					continue;
				}

				// Extract the gzipped icon using shell command with proper escaping
				try {
					await shell('sh', ['-c', `gunzip -c '${gzippedPath.replace(/'/g, "'\\''")}' > '${destPath.replace(/'/g, "'\\''")}'`], {
						skipStderrCheck: true,
					});
					Logger.info(`Extracted bundled icon: ${iconName}`);
					extractedCount++;
				} catch (error) {
					Logger.warn(`Failed to extract bundled icon ${iconName}:`, error);
				}
			}

			// Save list of bundled icons to a marker file
			if (bundledIconNames.length > 0) {
				const markerPath = `${iconsDir}/.bundled-icons`;
				await shellfs.writeFile(markerPath, bundledIconNames.join('\n'));
			}

			if (extractedCount > 0) {
				Logger.info(`Extracted ${extractedCount} bundled icon(s)`);
			}
		} catch (error) {
			Logger.warn('Failed to list bundled icons:', error);
		}
	} catch (error) {
		Logger.error('Failed to extract bundled icons:', error);
	}
}

/**
 * Get list of bundled icon names
 */
export async function getBundledIconNames(): Promise<string[]> {
	try {
		const dataDir = await getDataDir();
		const markerPath = `${dataDir}/icons/.bundled-icons`;

		const exists = await shellfs.exists(markerPath);
		if (!exists) {
			return [];
		}

		const content = await shellfs.readFile(markerPath);
		return content.trim().split('\n').filter(name => name.length > 0);
	} catch (error) {
		Logger.warn('Failed to read bundled icons list:', error);
		return [];
	}
}
