import { shell } from './tools/shell';

export function getMode(): 'dev' | 'prod' {
	return import.meta.env.MODE === 'development' ? 'dev' : 'prod';
}

export async function isProcessAlive(pid: number | string) {
	const cmd = await shell('ps', ['-p', pid.toString()], { skipStderrCheck: true });
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
	const res = JSON.parse(
		(await shell('curl', ['-X', 'GET', '-H', 'Content-Type: application/json', url], { skipStderrCheck: true })).stdOut
	);
	return res;
}

export function sleep(ms = 0) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
