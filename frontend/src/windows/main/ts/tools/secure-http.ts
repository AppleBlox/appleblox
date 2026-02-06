import { filesystem } from '@neutralinojs/lib';
import path from 'path-browserify';
import { shell, escapeShellArg } from './shell';
import { getCacheDir } from '../utils/paths';
import Logger from '@/windows/main/ts/utils/logger';

const logger = Logger.withContext('SecureHTTP');

export interface SecureRequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
	headers?: Record<string, string>;
	cookies?: Record<string, string>;
	body?: string | Record<string, any>;
	timeout?: number;
	followRedirects?: boolean;
}

export interface SecureResponse {
	success: boolean;
	statusCode: number;
	headers: Record<string, string>;
	body: string;
	error?: string;
}

/**
 * Generate a random ID for temp files
 */
function generateTempId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Securely delete a file by overwriting before deletion
 */
async function secureDelete(filepath: string): Promise<void> {
	try {
		await filesystem.writeFile(filepath, '\0'.repeat(1024));
		await filesystem.remove(filepath);
	} catch (e) {
		try {
			await filesystem.remove(filepath);
		} catch {}
	}
}

/**
 * Makes a secure HTTP request using curl with a config file
 * Sensitive data (cookies, auth headers) are written to a temp file
 * that is immediately deleted after the request completes
 */
export async function secureRequest(url: string, options: SecureRequestOptions = {}): Promise<SecureResponse> {
	const { method = 'GET', headers = {}, cookies = {}, body, timeout = 30, followRedirects = true } = options;

	try {
		new URL(url);
	} catch {
		return {
			success: false,
			statusCode: 0,
			headers: {},
			body: '',
			error: 'Invalid URL',
		};
	}

	const tempId = generateTempId();
	const cacheDir = await getCacheDir();
	const configPath = path.join(cacheDir, `.curl-config-${tempId}`);
	const outputPath = path.join(cacheDir, `.curl-output-${tempId}`);

	try {
		let configContent = '';

		configContent += 'silent\n';
		configContent += 'show-error\n';
		if (followRedirects) {
			configContent += 'location\n';
		}
		configContent += `max-time = ${timeout}\n`;
		configContent += `connect-timeout = ${Math.min(timeout, 10)}\n`;

		configContent += 'include\n';

		configContent += `request = "${method}"\n`;

		for (const [key, value] of Object.entries(headers)) {
			const safeValue = value.replace(/"/g, '\\"');
			configContent += `header = "${key}: ${safeValue}"\n`;
		}

		if (Object.keys(cookies).length > 0) {
			const cookieString = Object.entries(cookies)
				.map(([key, value]) => `${key}=${value}`)
				.join('; ');
			configContent += `cookie = "${cookieString}"\n`;
		}

		if (body) {
			const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
			const escapedBody = bodyStr.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
			configContent += `data = "${escapedBody}"\n`;
		}

		configContent += `output = "${outputPath}"\n`;

		configContent += `url = "${url}"\n`;

		configContent += 'write-out = "\\n__STATUS_CODE__:%{http_code}"\n';

		// Ensure cache directory exists before writing config file
		try {
			await filesystem.createDirectory(cacheDir);
		} catch {
			// Directory may already exist
		}

		await filesystem.writeFile(configPath, configContent);

		await shell('chmod', ['600', configPath], { skipStderrCheck: true });

		const command = `curl -K ${escapeShellArg(configPath)}`;

		const result = await shell(command, [], {
			completeCommand: true,
			skipStderrCheck: true,
			timeoutMs: (timeout + 5) * 1000,
		});

		let fullOutput = '';
		try {
			fullOutput = await filesystem.readFile(outputPath);
		} catch (e) {
			logger.warn('Could not read curl output file:', e);
		}

		const stdoutStatusMatch = result.stdOut.match(/__STATUS_CODE__:(\d{3})/);
		const statusCode = stdoutStatusMatch ? parseInt(stdoutStatusMatch[1], 10) : 0;

		const responseHeaders: Record<string, string> = {};
		let responseBody = '';

		if (fullOutput) {
			const headerBodySplit = fullOutput.split(/\r?\n\r?\n/);

			if (headerBodySplit.length >= 2) {
				const headerSection = headerBodySplit[0];
				responseBody = headerBodySplit.slice(1).join('\n\n').trim();

				const headerLines = headerSection.split(/\r?\n/);
				for (const line of headerLines) {
					const colonIndex = line.indexOf(':');
					if (colonIndex > 0) {
						const key = line.substring(0, colonIndex).trim().toLowerCase();
						const value = line.substring(colonIndex + 1).trim();
						responseHeaders[key] = value;
					}
				}
			} else {
				responseBody = fullOutput.trim();
			}
		}

		responseBody = responseBody.replace(/__STATUS_CODE__:\d{3}$/, '').trim();

		return {
			success: result.exitCode === 0 && statusCode >= 200 && statusCode < 400,
			statusCode,
			headers: responseHeaders,
			body: responseBody,
		};
	} catch (error) {
		logger.error('Secure request failed:', error);
		return {
			success: false,
			statusCode: 0,
			headers: {},
			body: '',
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	} finally {
		await secureDelete(configPath);
		await secureDelete(outputPath);
	}
}

/**
 * Convenience method for GET requests
 */
export async function secureGet(url: string, options: Omit<SecureRequestOptions, 'method'> = {}): Promise<SecureResponse> {
	return secureRequest(url, { ...options, method: 'GET' });
}

/**
 * Convenience method for POST requests
 */
export async function securePost(
	url: string,
	body?: string | Record<string, any>,
	options: Omit<SecureRequestOptions, 'method' | 'body'> = {}
): Promise<SecureResponse> {
	return secureRequest(url, { ...options, method: 'POST', body });
}

export default {
	request: secureRequest,
	get: secureGet,
	post: securePost,
};
