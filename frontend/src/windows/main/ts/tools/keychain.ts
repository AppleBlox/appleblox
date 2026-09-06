import { libraryPath } from '../libraries';
import { shell, spawn } from './shell';
import Logger from '@/windows/main/ts/utils/logger';

const logger = Logger.withContext('Keychain');

const SERVICE_NAME = 'ch.origaming.appleblox';

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

		// Register the exit listener BEFORE writing stdin to avoid a race
		// where the process exits before we start listening
		const exitPromise = new Promise<boolean>((resolve) => {
			let resolved = false;

			process.on('exit', (exitCode) => {
				if (resolved) return;
				resolved = true;
				if (exitCode === 0) {
					logger.info(`Credential stored successfully for account: ${account}`);
					resolve(true);
				} else {
					logger.error(`Failed to store credential for account: ${account}, exit code: ${exitCode}`);
					resolve(false);
				}
			});

			setTimeout(() => {
				if (resolved) return;
				resolved = true;
				logger.error('Keychain store operation timed out');
				resolve(false);
			}, 10000);
		});

		await process.writeStdin(credential);
		await process.endStdin();

		return exitPromise;
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

let _keychainConsentGiven = false;

export function hasKeychainConsent(): boolean {
	return _keychainConsentGiven;
}

export function grantKeychainConsent(): void {
	_keychainConsentGiven = true;
}

export default {
	storeCredential,
	retrieveCredential,
	deleteCredential,
	hasCredential,
	hasKeychainConsent,
	grantKeychainConsent,
};
