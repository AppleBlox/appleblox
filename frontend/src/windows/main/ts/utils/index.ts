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