import { libraryPath } from '../libraries';
import { shell, spawn } from './shell';
import Logger from '@/windows/main/ts/utils/logger';

const logger = Logger.withContext('Keychain');

const SERVICE_NAME = 'ch.origaming.appleblox';
const ROBLOX_COOKIE_ACCOUNT = 'roblox-cookie';

/**
 * Store a credential in the macOS Keychain
 * @param account - The account name (identifier for this credential)
 * @param credential - The credential to store (password, token, etc.)
 * @param service - Optional service name (defaults to AppleBlox)
 * @returns true if successful, false otherwise
 */
export async function storeCredential(account: string, credential: string, service: string = SERVICE_NAME): Promise<boolean> {
	try {
		const keychainPath = libraryPath('keychain');

		const process = await spawn(keychainPath, ['store', service, account]);

		await process.writeStdin(credential);
		await process.endStdin();

		return new Promise((resolve) => {
			process.on('exit', (exitCode) => {
				if (exitCode === 0) {
					logger.info(`Credential stored successfully for account: ${account}`);
					resolve(true);
				} else {
					logger.error(`Failed to store credential for account: ${account}, exit code: ${exitCode}`);
					resolve(false);
				}
			});

			setTimeout(() => {
				logger.error('Keychain store operation timed out');
				resolve(false);
			}, 10000);
		});
	} catch (error) {
		logger.error('Error storing credential:', error);
		return false;
	}
}

/**
 * Retrieve a credential from the macOS Keychain
 * @param account - The account name (identifier for this credential)
 * @param service - Optional service name (defaults to AppleBlox)
 * @returns The credential if found, null otherwise
 */
export async function retrieveCredential(account: string, service: string = SERVICE_NAME): Promise<string | null> {
	try {
		const keychainPath = libraryPath('keychain');
		const result = await shell(keychainPath, ['retrieve', service, account], { skipStderrCheck: true });

		if (result.exitCode === 0 && result.stdOut.length > 0) {
			return result.stdOut;
		} else if (result.exitCode === 2) {
			return null;
		} else {
			logger.warn(`Failed to retrieve credential for account: ${account}, exit code: ${result.exitCode}`);
			return null;
		}
	} catch (error) {
		logger.error('Error retrieving credential:', error);
		return null;
	}
}

/**
 * Delete a credential from the macOS Keychain
 * @param account - The account name (identifier for this credential)
 * @param service - Optional service name (defaults to AppleBlox)
 * @returns true if successful or not found, false on error
 */
export async function deleteCredential(account: string, service: string = SERVICE_NAME): Promise<boolean> {
	try {
		const keychainPath = libraryPath('keychain');
		const result = await shell(keychainPath, ['delete', service, account], { skipStderrCheck: true });

		if (result.exitCode === 0) {
			logger.info(`Credential deleted for account: ${account}`);
			return true;
		} else {
			logger.warn(`Failed to delete credential for account: ${account}, exit code: ${result.exitCode}`);
			return false;
		}
	} catch (error) {
		logger.error('Error deleting credential:', error);
		return false;
	}
}

/**
 * Check if a credential exists in the macOS Keychain
 * @param account - The account name (identifier for this credential)
 * @param service - Optional service name (defaults to AppleBlox)
 * @returns true if exists, false otherwise
 */
export async function hasCredential(account: string, service: string = SERVICE_NAME): Promise<boolean> {
	try {
		const keychainPath = libraryPath('keychain');
		const result = await shell(keychainPath, ['exists', service, account], { skipStderrCheck: true });

		return result.exitCode === 0;
	} catch (error) {
		logger.error('Error checking credential existence:', error);
		return false;
	}
}

/**
 * Store the Roblox .ROBLOSECURITY cookie securely
 * @param cookie - The .ROBLOSECURITY cookie value
 * @returns true if successful
 */
export async function storeRobloxCookie(cookie: string): Promise<boolean> {
	if (!cookie || cookie.length < 100) {
		logger.error('Invalid Roblox cookie format: too short');
		return false;
	}

	if (!cookie.includes('WARNING') && !cookie.startsWith('_|')) {
		logger.warn('Cookie may not be a valid .ROBLOSECURITY cookie');
	}

	return storeCredential(ROBLOX_COOKIE_ACCOUNT, cookie);
}

/**
 * Retrieve the stored Roblox .ROBLOSECURITY cookie
 * @returns The cookie if stored, null otherwise
 */
export async function getRobloxCookie(): Promise<string | null> {
	return retrieveCredential(ROBLOX_COOKIE_ACCOUNT);
}

/**
 * Delete the stored Roblox .ROBLOSECURITY cookie
 * @returns true if successful
 */
export async function deleteRobloxCookie(): Promise<boolean> {
	return deleteCredential(ROBLOX_COOKIE_ACCOUNT);
}

/**
 * Check if a Roblox cookie is stored
 * @returns true if a cookie is stored
 */
export async function hasRobloxCookie(): Promise<boolean> {
	return hasCredential(ROBLOX_COOKIE_ACCOUNT);
}

export default {
	storeCredential,
	retrieveCredential,
	deleteCredential,
	hasCredential,
	storeRobloxCookie,
	getRobloxCookie,
	deleteRobloxCookie,
	hasRobloxCookie,
};
