import { events, filesystem, os } from '@neutralinojs/lib';
import path from 'path-browserify';
import { storeCredential, retrieveCredential, deleteCredential, hasCredential } from '../tools/keychain';
import { parseBinaryCookies, extractRoblosecurity, buildRoblosecurityFile } from '../tools/binarycookies';
import { authenticatedRequest, getCsrfToken, validateArbitraryCookie, type UserInfo } from './api';
import Logger from '@/windows/main/ts/utils/logger';
import { Curl } from '../tools/curl';
import { detectRobloxPath } from './path';
import { shell, spawn } from '../tools/shell';
import { getValue } from '../../components/settings';
import { RobloxDelegate } from './delegate';
import { sleep } from '../utils';

const logger = Logger.withContext('Accounts');

const BINARY_COOKIES_FILENAME = 'com.roblox.RobloxPlayer.binarycookies';
const OLD_SINGLE_COOKIE_ACCOUNT = 'roblox-cookie';

export interface AccountInfo {
	userId: number;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	addedAt: number;
	lastValidated: number;
	source: 'auto-detect' | 'webview' | 'manual';
}

interface AccountsData {
	activeUserId: number | null;
	accounts: AccountInfo[];
	version: 1;
}

async function getAccountsFilePath(): Promise<string> {
	const dataDir = path.join(await os.getPath('data'), 'AppleBlox', 'config');
	return path.join(dataDir, 'accounts.json');
}

async function loadAccountsData(): Promise<AccountsData> {
	try {
		const filePath = await getAccountsFilePath();
		const content = await filesystem.readFile(filePath);
		return JSON.parse(content) as AccountsData;
	} catch {
		return { activeUserId: null, accounts: [], version: 1 };
	}
}

async function saveAccountsData(data: AccountsData): Promise<void> {
	const filePath = await getAccountsFilePath();
	await filesystem.writeFile(filePath, JSON.stringify(data, null, '\t'));
}

function keychainAccountKey(userId: number): string {
	return `roblox-cookie-${userId}`;
}

export async function getAccounts(): Promise<AccountInfo[]> {
	const data = await loadAccountsData();
	return data.accounts;
}

export async function getActiveAccount(): Promise<AccountInfo | null> {
	const data = await loadAccountsData();
	if (data.activeUserId === null) return null;
	return data.accounts.find((a) => a.userId === data.activeUserId) ?? null;
}

export async function getActiveUserId(): Promise<number | null> {
	const data = await loadAccountsData();
	return data.activeUserId;
}

export async function setActiveAccount(userId: number): Promise<void> {
	const data = await loadAccountsData();
	const account = data.accounts.find((a) => a.userId === userId);
	if (!account) {
		throw new Error(`Account ${userId} not found`);
	}
	data.activeUserId = userId;
	await saveAccountsData(data);
	logger.info(`Active account set to ${account.displayName} (${userId})`);
}

/**
 * Add or update an account. Validates the cookie via API, stores it in Keychain,
 * and saves metadata to the accounts file.
 */
export async function addAccount(cookie: string, source: AccountInfo['source']): Promise<AccountInfo> {
	const userInfo = await validateArbitraryCookie(cookie);
	if (!userInfo) {
		throw new Error('Cookie is invalid or expired');
	}

	// Store cookie in Keychain
	const stored = await storeCredential(keychainAccountKey(userInfo.id), cookie);
	if (!stored) {
		throw new Error('Failed to store cookie in Keychain');
	}

	const data = await loadAccountsData();
	const existing = data.accounts.find((a) => a.userId === userInfo.id);

	if (existing) {
		existing.username = userInfo.name;
		existing.displayName = userInfo.displayName;
		existing.lastValidated = Date.now();
		existing.source = source;
		logger.info(`Updated existing account: ${userInfo.displayName} (@${userInfo.name})`);
	} else {
		data.accounts.push({
			userId: userInfo.id,
			username: userInfo.name,
			displayName: userInfo.displayName,
			avatarUrl: null,
			addedAt: Date.now(),
			lastValidated: Date.now(),
			source,
		});
		logger.info(`Added new account: ${userInfo.displayName} (@${userInfo.name})`);
	}

	// Auto-set as active if no active account
	if (data.activeUserId === null) {
		data.activeUserId = userInfo.id;
	}

	await saveAccountsData(data);

	return data.accounts.find((a) => a.userId === userInfo.id)!;
}

/**
 * Add an account without validation (used during migration for possibly-expired cookies).
 */
async function addAccountWithoutValidation(
	userId: number,
	username: string,
	displayName: string,
	cookie: string,
	source: AccountInfo['source']
): Promise<void> {
	const stored = await storeCredential(keychainAccountKey(userId), cookie);
	if (!stored) {
		logger.error(`Failed to store cookie for user ${userId} during migration`);
		return;
	}

	const data = await loadAccountsData();
	if (!data.accounts.find((a) => a.userId === userId)) {
		data.accounts.push({
			userId,
			username,
			displayName,
			avatarUrl: null,
			addedAt: Date.now(),
			lastValidated: 0,
			source,
		});
	}

	if (data.activeUserId === null) {
		data.activeUserId = userId;
	}

	await saveAccountsData(data);
}

export async function removeAccount(userId: number): Promise<void> {
	await deleteCredential(keychainAccountKey(userId));

	const data = await loadAccountsData();
	data.accounts = data.accounts.filter((a) => a.userId !== userId);

	if (data.activeUserId === userId) {
		data.activeUserId = data.accounts.length > 0 ? data.accounts[0].userId : null;
	}

	await saveAccountsData(data);
	logger.info(`Removed account ${userId}`);
}

export async function removeAllAccounts(): Promise<void> {
	const data = await loadAccountsData();
	for (const account of data.accounts) {
		await deleteCredential(keychainAccountKey(account.userId));
	}
	data.accounts = [];
	data.activeUserId = null;
	await saveAccountsData(data);
	logger.info('Removed all accounts');
}

export async function updateAccountAvatar(userId: number, avatarUrl: string): Promise<void> {
	const data = await loadAccountsData();
	const account = data.accounts.find((a) => a.userId === userId);
	if (account) {
		account.avatarUrl = avatarUrl;
		await saveAccountsData(data);
	}
}

/**
 * Validate all accounts asynchronously, updating their lastValidated timestamp.
 * Accounts with invalid cookies get lastValidated set to 0.
 * This runs in the background and doesn't throw errors.
 */
export async function validateAllAccounts(): Promise<void> {
	try {
		const data = await loadAccountsData();
		let hasChanges = false;

		// Validate each account in parallel
		await Promise.all(
			data.accounts.map(async (account) => {
				try {
					const cookie = await retrieveCredential(keychainAccountKey(account.userId));
					if (!cookie) {
						// Cookie not in keychain
						if (account.lastValidated !== 0) {
							account.lastValidated = 0;
							hasChanges = true;
							logger.warn(`Account ${account.displayName} has no cookie in keychain`);
						}
						return;
					}

					const userInfo = await validateArbitraryCookie(cookie);
					if (userInfo && userInfo.id === account.userId) {
						// Valid cookie
						if (account.lastValidated === 0 || Date.now() - account.lastValidated > 60000) {
							account.lastValidated = Date.now();
							account.username = userInfo.name;
							account.displayName = userInfo.displayName;
							hasChanges = true;
							logger.info(`Validated account: ${account.displayName}`);
						}
					} else {
						// Invalid or expired cookie
						if (account.lastValidated !== 0) {
							account.lastValidated = 0;
							hasChanges = true;
							logger.warn(`Account ${account.displayName} has invalid/expired cookie`);
						}
					}
				} catch (err) {
					logger.warn(`Failed to validate account ${account.displayName}:`, err);
				}
			})
		);

		if (hasChanges) {
			await saveAccountsData(data);
		}
	} catch (err) {
		logger.error('Failed to validate accounts:', err);
	}
}

export async function getBinaryCookiesPath(): Promise<string> {
	const home = await os.getEnv('HOME');
	return path.join(home, 'Library', 'HTTPStorages', BINARY_COOKIES_FILENAME);
}

export async function detectAccountFromBinaryCookies(): Promise<AccountInfo | null> {
	try {
		const cookiePath = await getBinaryCookiesPath();
		const buffer = await filesystem.readBinaryFile(cookiePath);
		const cookies = parseBinaryCookies(buffer);
		const roblosecurity = extractRoblosecurity(cookies);

		if (!roblosecurity) {
			logger.info('No .ROBLOSECURITY cookie found in binary cookies file');
			return null;
		}

		return await addAccount(roblosecurity, 'auto-detect');
	} catch (err) {
		logger.warn('Failed to detect account from binary cookies:', err);
		return null;
	}
}

// Migration from single-account system

export async function migrateFromSingleAccount(): Promise<void> {
	const data = await loadAccountsData();
	if (data.accounts.length > 0) {
		return; // Already migrated
	}

	const hasOldCookie = await hasCredential(OLD_SINGLE_COOKIE_ACCOUNT);
	if (!hasOldCookie) {
		return; // Nothing to migrate
	}

	logger.info('Migrating from single-account to multi-account system...');

	const cookie = await retrieveCredential(OLD_SINGLE_COOKIE_ACCOUNT);
	if (!cookie) {
		logger.warn('Old cookie key exists but could not be retrieved');
		return;
	}

	try {
		// Try to validate the old cookie
		const userInfo = await validateArbitraryCookie(cookie);

		if (userInfo) {
			await storeCredential(keychainAccountKey(userInfo.id), cookie);

			const migrated: AccountsData = {
				activeUserId: userInfo.id,
				accounts: [
					{
						userId: userInfo.id,
						username: userInfo.name,
						displayName: userInfo.displayName,
						avatarUrl: null,
						addedAt: Date.now(),
						lastValidated: Date.now(),
						source: 'manual',
					},
				],
				version: 1,
			};
			await saveAccountsData(migrated);
			logger.info(`Migrated account: ${userInfo.displayName} (@${userInfo.name})`);
		} else {
			// Cookie expired — store with placeholder info so user sees it in UI
			await addAccountWithoutValidation(0, 'Unknown', 'Expired Account', cookie, 'manual');
			logger.warn('Migrated expired cookie (validation failed)');
		}

		// Clean up old key
		await deleteCredential(OLD_SINGLE_COOKIE_ACCOUNT);
	} catch (err) {
		logger.error('Migration failed:', err);
	}
}

export async function getRobloxCookie(): Promise<string | null> {
	const active = await getActiveAccount();
	if (!active) return null;
	return retrieveCredential(keychainAccountKey(active.userId));
}

export async function hasRobloxCookie(): Promise<boolean> {
	const active = await getActiveAccount();
	return active !== null;
}

export async function storeRobloxCookie(cookie: string): Promise<boolean> {
	try {
		await addAccount(cookie, 'manual');
		return true;
	} catch {
		return false;
	}
}

export async function deleteRobloxCookie(): Promise<boolean> {
	const active = await getActiveAccount();
	if (!active) return false;
	await removeAccount(active.userId);
	return true;
}

/**
 * Check if a specific account's cookie is currently present in the Roblox
 * binary cookies file. Used to determine if an auto-detected account is
 * still logged in to the Roblox app (and thus should be non-removable).
 */
export async function isAccountInBinaryCookies(userId: number): Promise<boolean> {
	try {
		const cookiePath = await getBinaryCookiesPath();
		const buffer = await filesystem.readBinaryFile(cookiePath);
		const cookies = parseBinaryCookies(buffer);
		const roblosecurity = extractRoblosecurity(cookies);
		if (!roblosecurity) return false;

		// Validate the cookie to get the userId it belongs to
		const userInfo = await validateArbitraryCookie(roblosecurity);
		return userInfo !== null && userInfo.id === userId;
	} catch {
		return false;
	}
}

/**
 * Obtain an authentication ticket that can be used for launching Roblox with a specific account.
 */
async function getAuthTicketForAccount(): Promise<string | null> {
	const token = await getCsrfToken();
	if (!token) {
		logger.error("Couldn't get CSRF token");
		return null;
	}
	try {
		const res = await authenticatedRequest('https://auth.roblox.com/v1/authentication-ticket', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-csrf-token': token, Referer: 'https://www.roblox.com/' },
		});
		if (!res) {
			logger.error('Authenticate response was null');
			return null;
		}
		const authTicket = res.headers?.['rbx-authentication-ticket'];
		if (!authTicket) {
			logger.error('Returned authTicket was null');
			return null;
		}
		return authTicket;
	} catch (err) {
		logger.error(err, 'Failed to obtain auth ticket for account');
		return null;
	}
}

/**
 * Launches Roblox with the authenticate URL to connect the active account.
 *
 * SECURITY NOTE: The auth ticket is passed via stdin using `read -s` to avoid terminal echo,
 * but it will still appear briefly in the process arguments of the `open` command. This is
 * an inherent limitation of the macOS `open` command requiring the URL as an argument.
 *
 * Mitigation: Auth tickets are short-lived (typically 5-30 seconds) and single-use only.
 * The risk is limited to local processes that can read /proc or use `ps` during this window.
 */
export async function launchRobloxWithActiveAccount(): Promise<void> {
	const authTicket = await getAuthTicketForAccount();
	if (!authTicket) {
		throw new Error("Couldn't obtain auth ticket");
	}

	// Delete the binary cookies file to ensure a clean login
	try {
		const cookiePath = await getBinaryCookiesPath();
		await filesystem.remove(cookiePath);
		logger.info('Deleted binary cookies file before launching Roblox');
	} catch (err) {
		// File might not exist, which is fine
		logger.debug('Failed to delete binary cookies (may not exist):', err);
	}

	// Small delay to ensure file deletion completes
	await sleep(200);

	const browserTrackerId = Math.floor(Math.random() * 1000000000);
	const launchTime = Date.now();
	const launcherUrl = `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGame&browserTrackerId=${browserTrackerId}&placeId=109510215435892&isPlayTogetherGame=false`;

	const url = `roblox-player:1+launchmode:play+gameinfo:$AUTH_TICKET+launchtime:${launchTime}+placelauncherurl:${launcherUrl}`;

	const isDelegateLaunchingEnabled = await getValue<boolean>('roblox.behavior.delegate');
	await RobloxDelegate.toggle(false);

	// Use stdin injection to minimize exposure, though ticket will still appear in process args
	await shell(`open "${url}"`, [], { completeCommand: true, secrets: { AUTH_TICKET: authTicket } });

	await sleep(5000);
	await RobloxDelegate.toggle(isDelegateLaunchingEnabled);
}
