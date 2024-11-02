import { shell } from '../tools/shell';

export function getMode(): 'dev' | 'prod' {
	return import.meta.env.MODE === 'development' ? 'dev' : 'prod';
}

export async function isProcessAlive(pid: number | string) {
	const cmd = await shell('ps', ['-p', pid.toString()], { skipStderrCheck: true });
	return cmd.stdOut.includes(String(pid));
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

/**
 * Interface representing the result of JSON parsing operation
 */
interface JSONParseResult {
	/** The successfully parsed JSON object */
	parsedJSON: any;
	/** Array of corrections made during parsing */
	corrections: string[];
}

/**
 * Returns the current date in a format compatible with POSIX path names.
 * The format is: YYYY-MM-DD_HH-mm-ss
 *
 * @returns {string} The formatted date string
 */
export function getPosixCompatibleDate(): string {
	const now = new Date();

	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');

	return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}
