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
 * Attempts to correct and parse potentially invalid JSON input with support for nested JSON objects.
 * Specifically handles the case of double-escaped nested JSON strings.
 *
 * @param {string} input - The JSON string to correct and parse
 * @returns {JSONParseResult} Object containing parsed JSON and correction records
 * @throws {Error} If the JSON cannot be parsed after attempted corrections
 */
export function correctAndParseJSON(input: string): JSONParseResult {
	const corrections: string[] = [];
	let jsonString = input.trim();

	// Step 1: First try to parse as-is
	try {
		const parsed = JSON.parse(jsonString);
		return { parsedJSON: parsed, corrections };
	} catch (e) {
		// Continue with corrections if direct parsing fails
	}

	// Step 2: Handle escaped string values that should be objects
	try {
		// Replace escaped quotes with temporary markers
		jsonString = jsonString.replace(/\\"/g, '__QUOTE__');

		// Parse the JSON with temporary markers
		let parsed = JSON.parse(jsonString.replace(/__QUOTE__/g, '"'));

		// Process any string values that look like they should be objects
		for (const key in parsed) {
			if (typeof parsed[key] === 'string') {
				try {
					// If the string value looks like JSON, try to parse it
					if (parsed[key].includes('{') && parsed[key].includes('}')) {
						const unescaped = parsed[key].replace(/\\\\"/g, '"').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
						parsed[key] = JSON.parse(unescaped);
						corrections.push(`Parsed nested JSON in key: ${key}`);
					}
				} catch (innerError) {
					// If parsing the nested JSON fails, leave it as a string
					corrections.push(`Failed to parse nested JSON in key: ${key}`);
				}
			}
		}

		return { parsedJSON: parsed, corrections };
	} catch (error) {
		// If all parsing attempts fail, throw an error with details
		throw new Error(
			`Failed to parse JSON: ${(error as Error).message}\nNear: ${jsonString.substring(
				Math.max(0, (error as any).pos - 50),
				Math.min(jsonString.length, (error as any).pos + 50)
			)}`
		);
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
