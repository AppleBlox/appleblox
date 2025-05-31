import { shell, type ExecuteOptions, type ExecutionResult } from './shell';

interface CurlOptions extends ExecuteOptions {
	method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	headers?: Record<string, string>;
	data?: string | Record<string, any>;
	followRedirects?: boolean;
	maxRedirects?: number;
	silent?: boolean;
	insecure?: boolean;
	compressed?: boolean;
}

interface CurlResponse {
	success: boolean;
	statusCode?: number;
	headers?: Record<string, string>;
	body?: string;
	error?: string;
	raw: ExecutionResult;
}

export class Curl {
	private static parseHeaders(headerStr: string): Record<string, string> {
		const headers: Record<string, string> = {};
		const lines = headerStr.split('\n');

		for (const line of lines) {
			const match = line.match(/^([^:]+):\s*(.+)/);
			if (match) {
				headers[match[1].toLowerCase()] = match[2].trim();
			}
		}

		return headers;
	}

	private static parseStatusCode(output: string): number | undefined {
		const statusLine = output.split('\n')[0];
		const match = statusLine.match(/HTTP\/[\d.]+ (\d+)/);
		return match ? parseInt(match[1], 10) : undefined;
	}

	static async request(url: string, options: CurlOptions = {}): Promise<CurlResponse> {
		try {
			// Validate URL
			new URL(url);
		} catch (error) {
			return {
				success: false,
				error: 'Invalid URL format',
				raw: { stdOut: '', stdErr: 'Invalid URL format', exitCode: 1 },
			};
		}

		const args: string[] = [];

		// Basic options
		if (options.silent !== false) args.push('-s');
		if (options.insecure) args.push('-k');
		if (options.compressed) args.push('--compressed');
		if (options.followRedirects !== false) args.push('-L');
		if (options.maxRedirects) args.push('-max-redirs', options.maxRedirects.toString());

		// Method
		if (options.method) {
			args.push('-X', options.method);
		}

		// Headers
		if (options.headers) {
			Object.entries(options.headers).forEach(([key, value]) => {
				args.push('-H', `${key}: ${value}`);
			});
		}

		// Data
		if (options.data) {
			const data = typeof options.data === 'string' ? options.data : JSON.stringify(options.data);
			args.push('-d', data);

			// Automatically set Content-Type for JSON data if not already set
			if (typeof options.data !== 'string' && (!options.headers || !options.headers['Content-Type'])) {
				if (!options.headers) options.headers = {};
				options.headers['Content-Type'] = 'application/json';
			}
		}

		// Include headers in output
		args.push('-i');

		// Add URL
		args.push(url);

		try {
			const result = await shell('curl', args, {
				timeoutMs: options.timeoutMs,
				skipStderrCheck: options.skipStderrCheck,
				cwd: options.cwd,
			});

			if (result.exitCode !== 0) {
				return {
					success: false,
					error: result.stdErr || 'Curl command failed',
					raw: result,
				};
			}

			const [headers, ...bodyParts] = result.stdOut.split('\r\n\r\n');
			const body = bodyParts.join('\r\n\r\n');

			return {
				success: true,
				statusCode: this.parseStatusCode(headers),
				headers: this.parseHeaders(headers),
				body: body.trim(),
				raw: result,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
				raw: {
					stdOut: '',
					stdErr: error instanceof Error ? error.message : 'Unknown error',
					exitCode: 1,
				},
			};
		}
	}

	static async isReachable(url: string, timeoutMs = 5000): Promise<boolean> {
		const response = await this.request(url, {
			method: 'HEAD',
			timeoutMs,
			silent: true,
			skipStderrCheck: true,
		});
		return response.success && (response.statusCode || 0) < 400;
	}

	static async get(url: string, options: Omit<CurlOptions, 'method'> = {}): Promise<CurlResponse> {
		return this.request(url, { ...options, method: 'GET' });
	}

	static async post(
		url: string,
		data?: CurlOptions['data'],
		options: Omit<CurlOptions, 'method' | 'data'> = {}
	): Promise<CurlResponse> {
		return this.request(url, { ...options, method: 'POST', data });
	}

	static async head(url: string, options: Omit<CurlOptions, 'method'> = {}): Promise<CurlResponse> {
		return this.request(url, { ...options, method: 'HEAD' });
	}
}
