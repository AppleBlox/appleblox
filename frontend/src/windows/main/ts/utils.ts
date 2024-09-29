import { os } from '@neutralinojs/lib';

export function getMode(): 'dev' | 'prod' {
	return import.meta.env.MODE === 'development' ? 'dev' : 'prod';
}

/**
 * Removes non-UTF-8 characters from a string using iconv-lite.
 * @param {string} str - The input string potentially containing non-UTF-8 characters.
 */
export async function removeNonUTF8CharactersFromString(str: string) {
	return (await os.execCommand(`echo "${str}" | iconv -c -f utf-8 -t utf-8`)).stdOut.trim();
}

export async function isProcessAlive(pid: number | string) {
	const cmd = await os.execCommand(`ps -p ${pid}`);
	return cmd.stdOut.includes(String(pid));
}

export function getStringDiff(oldStr: string, newStr: string): string {
	if (oldStr === newStr) return '';
	const oldChars = oldStr.split('');
	const newChars = newStr.split('');
	let startDiff = 0;
	let endDiff = 0;
	while (startDiff < oldChars.length && startDiff < newChars.length && oldChars[startDiff] === newChars[startDiff]) {
		startDiff++;
	}
	while (
		endDiff < oldChars.length - startDiff &&
		endDiff < newChars.length - startDiff &&
		oldChars[oldChars.length - 1 - endDiff] === newChars[newChars.length - 1 - endDiff]
	) {
		endDiff++;
	}
	const diff = newChars.slice(startDiff, newChars.length - endDiff).join('');
	return diff;
}

export async function curlGet(url: string): Promise<any> {
	const cmd = `curl -X GET -H "Content-Type: application/json" "${url}"`;
	const res = JSON.parse(await (await os.execCommand(cmd)).stdOut.trim());
	return res;
}

/**
 * Compare two semantic version strings.
 *
 * @param {string} v1 - The first version string.
 * @param {string} v2 - The second version string.
 * @returns {number} -1 if v1 < v2, 1 if v1 > v2, 0 if they are equal.
 */
export function compareVersions(v1: string, v2: string): number {
	const v1Parts: number[] = v1.split('.').map(Number);
	const v2Parts: number[] = v2.split('.').map(Number);

	for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
		const v1Part: number = v1Parts[i] || 0;
		const v2Part: number = v2Parts[i] || 0;

		if (v1Part > v2Part) {
			return 1;
		}
		if (v1Part < v2Part) {
			return -1;
		}
	}

	return 0;
}

export function sleep(ms = 0) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
