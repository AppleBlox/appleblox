/**
 * Options for JSON parsing
 */
interface ParseOptions {
	/** Whether to provide user-friendly error messages */
	friendly?: boolean;
	/** Default value for incomplete key-value pairs */
	defaultValue?: string | number | boolean | null;
}

/**
 * Token types for JSON parsing
 */
type TokenType = 'startObject' | 'endObject' | 'startArray' | 'endArray' | 'key' | 'value' | 'colon' | 'comma' | 'string';

/**
 * Token interface representing parsed elements
 */
interface Token {
	type: TokenType;
	content?: string;
	line?: number;
	column?: number;
}

/**
 * Custom error class for JSON parsing errors
 */
class JSONParseError extends Error {
	public line?: number;
	public column?: number;
	public friendly: string;

	constructor(message: string, friendly: string, line?: number, column?: number) {
		super(message);
		this.name = 'JSONParseError';
		this.friendly = friendly;
		this.line = line;
		this.column = column;
	}
}

/**
 * Attempts to parse and correct malformed JSON strings with user-friendly error reporting.
 *
 * @param input - The potentially malformed JSON string to parse
 * @param options - Parsing options
 * @returns The parsed JavaScript object
 * @throws JSONParseError with user-friendly messages if parsing fails
 *
 * @example
 * // Basic usage with friendly errors
 * try {
 *   const result = correctAndParseJSON('{"key: value}', { friendly: true });
 * } catch (e) {
 *   if (e instanceof JSONParseError) {
 *     console.log(e.friendly); // "Missing quotes around the key 'key'"
 *   }
 * }
 */
function correctAndParseJSON(input: string, options: ParseOptions = {}): any {
	const { friendly = false, defaultValue = null } = options;

	if (!input?.trim()) {
		throw new JSONParseError('Empty input', 'The input is empty. Please provide some JSON data.', 1, 1);
	}

	let jsonString = input.trim();
	let currentLine = 1;
	let currentColumn = 1;

	// Helper to track position
	function updatePosition(str: string): void {
		for (const char of str) {
			if (char === '\n') {
				currentLine++;
				currentColumn = 1;
			} else {
				currentColumn++;
			}
		}
	}

	// Create user-friendly error
	function createError(message: string, friendly: string): JSONParseError {
		return new JSONParseError(message, friendly, currentLine, currentColumn);
	}

	// First normalize basic structure
	if (jsonString.includes(':') && !jsonString.startsWith('{')) {
		jsonString = '{' + jsonString;
	}
	if (jsonString.endsWith('}') && jsonString.startsWith('{')) {
		// We're good
	} else if (jsonString.includes(':')) {
		jsonString = jsonString + '}';
	}

	// First try direct parse
	try {
		return JSON.parse(jsonString);
	} catch (e) {
		// Continue with corrections
	}

	// Clean up the string
	jsonString = jsonString
		.replace(/\/\/.*$/gm, '') // Remove line comments
		.replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
		.replace(/\b(undefined|NaN)\b/g, 'null') // Handle special values
		.trim();

	function tokenize(str: string): Token[] {
		const tokens: Token[] = [];
		let buffer = '';
		const state = {
			inString: false,
			quoteChar: null as string | null,
			braceDepth: 0,
			bracketDepth: 0,
			escaping: false,
		};

		function pushToken(type: TokenType, value: string): void {
			if (value?.trim()) {
				tokens.push({
					type,
					content: value.trim(),
					line: currentLine,
					column: currentColumn - value.length,
				});
			}
		}

		for (let i = 0; i < str.length; i++) {
			const char = str[i];
			updatePosition(char);

			if (state.escaping) {
				buffer += char;
				state.escaping = false;
				continue;
			}

			if (char === '\\') {
				state.escaping = true;
				buffer += char;
				continue;
			}

			if ((char === '"' || char === "'") && !state.escaping) {
				if (!state.inString) {
					if (buffer.trim()) pushToken('value', buffer);
					buffer = '';
					state.inString = true;
					state.quoteChar = char;
				} else if (char === state.quoteChar) {
					pushToken('string', buffer);
					buffer = '';
					state.inString = false;
					state.quoteChar = null;
				} else {
					buffer += char;
				}
				continue;
			}

			if (!state.inString) {
				if (char === '{') {
					if (buffer.trim()) pushToken('value', buffer);
					tokens.push({ type: 'startObject', line: currentLine, column: currentColumn });
					buffer = '';
					state.braceDepth++;
					continue;
				}
				if (char === '}') {
					if (buffer.trim()) pushToken('value', buffer);
					tokens.push({ type: 'endObject', line: currentLine, column: currentColumn });
					buffer = '';
					state.braceDepth--;
					continue;
				}
				if (char === ':') {
					if (buffer.trim()) pushToken('key', buffer);
					tokens.push({ type: 'colon', line: currentLine, column: currentColumn });
					buffer = '';
					continue;
				}
				if (char === ',') {
					if (buffer.trim()) pushToken('value', buffer);
					tokens.push({ type: 'comma', line: currentLine, column: currentColumn });
					buffer = '';
					continue;
				}
				if (char === '\n' || char === '\r') {
					if (buffer.trim()) pushToken('value', buffer);
					buffer = '';
					continue;
				}
			}

			buffer += char;
		}

		// Handle any remaining buffer
		if (buffer.trim()) {
			pushToken('value', buffer);
		}

		return tokens;
	}

	function buildJSON(tokens: Token[]): string {
		let result = '';
		let lastType: TokenType | null = null;
		let lastToken: Token | null = null;

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			const { type, content, line, column } = token;

			// Validate token sequence
			if (friendly) {
				if (type === 'key' && lastType === 'key') {
					throw createError(
						'Missing colon between keys',
						`Missing colon after key "${lastToken?.content}" at line ${lastToken?.line}`
					);
				}
				if (type === 'value' && lastType === 'key' && !tokens.some((t) => t.type === 'colon')) {
					throw createError(
						'Missing colon before value',
						`Missing colon between key "${lastToken?.content}" and value "${content}"`
					);
				}
			}

			const needsComma =
				lastType &&
				!['comma', 'colon', 'startObject'].includes(lastType) &&
				!['endObject', 'comma', 'colon'].includes(type);

			if (needsComma) result += ',';

			switch (type) {
				case 'startObject':
					result += '{';
					break;
				case 'endObject':
					result += '}';
					break;
				case 'key':
					result += `"${content?.replace(/"/g, '\\"')}"`;
					break;
				case 'colon':
					result += ':';
					break;
				case 'comma':
					result += ',';
					break;
				case 'string':
				case 'value':
					if (content === undefined && defaultValue !== undefined) {
						result += JSON.stringify(defaultValue);
					} else if (/^-?\d+\.?\d*$/.test(content || '') || /^(true|false|null)$/i.test(content || '')) {
						result += (content || '').toLowerCase();
					} else {
						result += `"${(content || '').replace(/"/g, '\\"')}"`;
					}
					break;
			}

			lastType = type;
			lastToken = token;
		}

		return result;
	}

	try {
		const tokens = tokenize(jsonString);
		const processed = buildJSON(tokens);
		return JSON.parse(processed);
	} catch (error) {
		if (friendly) {
			if (error instanceof JSONParseError) {
				throw error;
			}

			// Convert standard JSON errors to friendly messages
			const errorMsg = (error as Error).message;
			if (errorMsg.includes('Unexpected token')) {
				throw createError(errorMsg, `Invalid character found in JSON. Check for missing quotes or commas.`);
			}
			if (errorMsg.includes('Expected')) {
				throw createError(
					errorMsg,
					`JSON structure is incorrect. Make sure all brackets and braces are properly closed.`
				);
			}
		}
		throw error;
	}
}

export { correctAndParseJSON, JSONParseError, type ParseOptions };
