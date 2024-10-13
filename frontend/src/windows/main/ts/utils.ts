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

/**
 * Attempts to correct and parse potentially invalid JSON input.
 *
 * @param {string} input - The JSON string to correct and parse.
 * @returns {{ parsedJSON: any; corrections: string[] }} An object containing the parsed JSON and an array of corrections made.
 * @throws {Error} If the JSON cannot be parsed after corrections.
 */
export function correctAndParseJSON(input: string): { parsedJSON: any; corrections: string[] } {
	const corrections: string[] = [];
	let jsonString = input.trim();

	// Correct missing opening brace
	if (!jsonString.startsWith('{')) {
		jsonString = '{' + jsonString;
		corrections.push('Added missing opening brace');
	}

	// Correct missing closing brace
	if (!jsonString.endsWith('}')) {
		const lastIndex = jsonString.lastIndexOf('}');
		if (lastIndex === -1) {
			jsonString += '}';
			corrections.push('Added missing closing brace');
		} else {
			jsonString = jsonString.substring(0, lastIndex + 1);
			corrections.push('Removed extra characters after closing brace');
		}
	}

	// Remove comments (both single-line and multi-line)
	jsonString = jsonString.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
	if (jsonString !== input.trim()) {
		corrections.push('Removed comments');
	}

	// Fix trailing commas in objects and arrays
	jsonString = jsonString.replace(/,\s*([\]}])/g, '$1');
	if (jsonString !== input.trim()) {
		corrections.push('Removed trailing commas');
	}

	// Attempt to fix unquoted keys
	jsonString = jsonString.replace(/(\{|\,)\s*(\w+)\s*\:/g, '$1"$2":');
	if (jsonString !== input.trim()) {
		corrections.push('Added quotes to unquoted keys');
	}

	// Attempt to fix single quotes
	jsonString = jsonString.replace(/'/g, '"');
	if (jsonString !== input.trim()) {
		corrections.push('Replaced single quotes with double quotes');
	}

	try {
		// Attempt to parse the corrected JSON string
		const parsedJSON = JSON.parse(jsonString);
		return { parsedJSON, corrections };
	} catch (error) {
		// If parsing still fails, throw an error with details
		throw new Error(`Failed to parse JSON: ${(error as Error).message}`);
	}
}
