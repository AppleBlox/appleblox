import { shell } from '../tools/shell';
import { exists as pathExists } from '../tools/shellfs';
import Logger from '@/windows/main/ts/utils/logger';
import path from 'path-browserify';

/**
 * Searches the entire system for Roblox installations using macOS Spotlight.
 * Falls back to find command if mdfind fails.
 * @returns Array of Roblox.app paths sorted by modification time (most recent first)
 */
export async function findRobloxInstallations(): Promise<string[]> {
	const installations: string[] = [];

	try {
		// Strategy 1: Use mdfind (Spotlight) for system-wide search
		Logger.info('Searching for Roblox installations using Spotlight (mdfind)...');
		const mdfindResult = await shell(
			`mdfind "kMDItemDisplayName == '*Roblox*.app' && kMDItemKind == 'Application'" 2>/dev/null`,
			[],
			{
				completeCommand: true,
				skipStderrCheck: true,
			}
		);

		if (mdfindResult.stdOut.trim()) {
			const paths = mdfindResult.stdOut
				.trim()
				.split('\n')
				.filter((p) => p.endsWith('.app') && p.toLowerCase().includes('roblox'));
			installations.push(...paths);
			Logger.info(`Found ${paths.length} Roblox installation(s) via mdfind: ${paths.join(', ')}`);
		}
	} catch (err) {
		Logger.warn('mdfind search failed, falling back to find command:', err);
	}

	// Strategy 2: Fallback to find in common locations if mdfind found nothing
	if (installations.length === 0) {
		try {
			Logger.info('Searching common locations with find command...');
			const findResult = await shell(
				`find /Applications "$HOME/Applications" -maxdepth 1 -iname '*roblox*.app' -exec stat -f '%m %N' {} + 2>/dev/null | sort -nr | cut -d' ' -f2-`,
				[],
				{
					completeCommand: true,
					skipStderrCheck: true,
				}
			);

			if (findResult.stdOut.trim()) {
				const paths = findResult.stdOut
					.trim()
					.split('\n')
					.filter((p) => p.endsWith('.app'));
				installations.push(...paths);
				Logger.info(`Found ${paths.length} Roblox installation(s) via find: ${paths.join(', ')}`);
			}
		} catch (err) {
			Logger.warn('find command failed:', err);
		}
	}

	// Strategy 3: Check common hardcoded paths as last resort
	if (installations.length === 0) {
		const commonPaths = ['/Applications/Roblox.app', `${process.env.HOME}/Applications/Roblox.app`];

		for (const commonPath of commonPaths) {
			try {
				if (await pathExists(commonPath)) {
					installations.push(commonPath);
					Logger.info(`Found Roblox at common path: ${commonPath}`);
				}
			} catch (err) {
				// Ignore errors checking common paths
			}
		}
	}

	// Sort by modification time (most recent first)
	if (installations.length > 1) {
		try {
			const pathsWithMtime: { path: string; mtime: number }[] = [];

			for (const installPath of installations) {
				const statResult = await shell('stat', ['-f', '%m', installPath], { skipStderrCheck: true });
				const mtime = parseInt(statResult.stdOut.trim(), 10);
				pathsWithMtime.push({ path: installPath, mtime: isNaN(mtime) ? 0 : mtime });
			}

			pathsWithMtime.sort((a, b) => b.mtime - a.mtime);
			return pathsWithMtime.map((p) => p.path);
		} catch (err) {
			Logger.warn('Failed to sort installations by modification time:', err);
		}
	}

	return installations;
}

/**
 * Validates that a path points to a legitimate Roblox installation.
 * @param robloxPath - The path to validate
 * @returns True if the path is a valid Roblox installation
 */
export async function validateRobloxPath(robloxPath: string | null): Promise<boolean> {
	if (!robloxPath) {
		return false;
	}

	try {
		// Check if path exists
		if (!(await pathExists(robloxPath))) {
			Logger.warn(`Roblox path does not exist: ${robloxPath}`);
			return false;
		}

		// Check if it's a .app bundle
		if (!robloxPath.endsWith('.app')) {
			Logger.warn(`Path is not a .app bundle: ${robloxPath}`);
			return false;
		}

		// Verify Contents/Info.plist exists
		const plistPath = path.join(robloxPath, 'Contents/Info.plist');
		if (!(await pathExists(plistPath))) {
			Logger.warn(`Info.plist not found at: ${plistPath}`);
			return false;
		}

		// Read plist and verify it's actually Roblox
		const plistResult = await shell('plutil', ['-p', plistPath], { skipStderrCheck: true });
		const plistContent = plistResult.stdOut;

		// Check for Roblox bundle identifier
		if (!plistContent.includes('com.roblox')) {
			Logger.warn(`Path does not appear to be Roblox (no com.roblox bundle identifier): ${robloxPath}`);
			return false;
		}

		Logger.info(`Validated Roblox installation at: ${robloxPath}`);
		return true;
	} catch (err) {
		Logger.error(`Error validating Roblox path ${robloxPath}:`, err);
		return false;
	}
}

/**
 * Detects Roblox installation path using comprehensive search strategies.
 * @returns The path to Roblox.app, or null if not found
 */
export async function detectRobloxPath(): Promise<string | null> {
	Logger.info('Starting Roblox path detection...');

	try {
		const installations = await findRobloxInstallations();

		if (installations.length === 0) {
			Logger.warn('No Roblox installations found on this Mac');
			return null;
		}

		// Validate installations in order (most recent first)
		for (const installPath of installations) {
			if (await validateRobloxPath(installPath)) {
				Logger.info(`Selected Roblox installation: ${installPath}`);
				return installPath;
			}
		}

		Logger.warn('Found potential Roblox installations, but none passed validation');
		return null;
	} catch (err) {
		Logger.error('Error during Roblox path detection:', err);
		return null;
	}
}

/**
 * Gets the most recent Roblox installation path.
 * @deprecated Use detectRobloxPath() instead for better error handling
 * @returns The path to Roblox.app, or null if not found
 */
export async function getMostRecentRoblox(): Promise<string | null> {
	return detectRobloxPath();
}
