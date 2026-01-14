import path from 'path-browserify';
import shellFS from '../tools/shellfs';
import { detectRobloxPath } from './path';
import Logger from '@/windows/main/ts/utils/logger';

export let version: string | null = null;

export async function getVersion(): Promise<string | null> {
	await loadVersion();
	return version;
}

function extractVersion(plistString: string): string | null {
	const regex = /<key>CFBundleVersion<\/key>\s*<string>(\d+)<\/string>/;
	const match = plistString.match(regex);
	if (!match) return null;
	const version = match ? match[1] : '';
	return version.slice(0, 3);
}

async function loadVersion() {
	if (version) return;
	const robloxPath = await detectRobloxPath();
	if (!robloxPath) {
		Logger.warn('Roblox installation not found. Cannot load version.');
		return;
	}
	const plistPath = path.join(robloxPath, 'Contents/Info.plist');
	const content = await shellFS.readFile(plistPath);
	version = extractVersion(content);
	Logger.info(`Found Roblox version "${version}"`);
}

loadVersion().catch(Logger.error);
