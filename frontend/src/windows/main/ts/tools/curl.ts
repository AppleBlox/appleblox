import { shell, spawn, type ExecuteOptions, type ExecutionResult } from './shell';

interface CurlOptions extends ExecuteOptions {
	method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	headers?: Record<string, string>;
	data?: string | Record<string, any>;
	followRedirects?: boolean;
	maxRedirects?: number;
	silent?: boolean;
	insecure?: boolean;
	compressed?: boolean;
	userAgent?: string;
	referer?: string;
	cookies?: Record<string, string>;
	proxy?: string;
	connectTimeout?: number;
	maxTime?: number;
	retries?: number;
	retryDelay?: number;
	outputFile?: string;
	resumeFrom?: number;
	maxFileSize?: number;
	progressCallback?: (progress: DownloadProgress) => void;
}

interface CurlResponse {
	success: boolean;
	statusCode?: number;
	headers?: Record<string, string>;
	body?: string;
	error?: string;
	raw: ExecutionResult;
	finalUrl?: string;
	totalTime?: number;
	downloadSize?: number;
	uploadSize?: number;
	avgDownloadSpeed?: number;
	avgUploadSpeed?: number;
}

interface DownloadProgress {
	/** Total file size in bytes (if known) */
	totalSize?: number;
	/** Downloaded bytes so far */
	downloadedSize: number;
	/** Upload size (for uploads) */
	uploadedSize?: number;
	/** Download speed in bytes per second */
	downloadSpeed: number;
	/** Upload speed in bytes per second */
	uploadSpeed?: number;
	/** Progress percentage (0-100) */
	percentage: number;
	/** Estimated time remaining in seconds */
	timeRemaining?: number;
	/** Elapsed time in seconds */
	elapsedTime: number;
}

interface ProgressiveDownloadOptions extends Omit<CurlOptions, 'progressCallback'> {
	/** Callback function called with progress updates */
	onProgress: (progress: DownloadProgress) => void;
	/** Path where to save the downloaded file */
	outputPath: string;
	/** Whether to resume partial downloads */
	resume?: boolean;
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

	private static parseCurlStats(output: string): Partial<CurlResponse> {
		const stats: Partial<CurlResponse> = {};

		// Parse various curl statistics from verbose output
		const lines = output.split('\n');
		for (const line of lines) {
			if (line.includes('Total time:')) {
				const match = line.match(/Total time:\s*([\d.]+)/);
				if (match) stats.totalTime = parseFloat(match[1]);
			}
			if (line.includes('Average download speed:')) {
				const match = line.match(/Average download speed:\s*([\d.]+)/);
				if (match) stats.avgDownloadSpeed = parseFloat(match[1]);
			}
			if (line.includes('Average upload speed:')) {
				const match = line.match(/Average upload speed:\s*([\d.]+)/);
				if (match) stats.avgUploadSpeed = parseFloat(match[1]);
			}
		}

		return stats;
	}

	private static parseProgressLine(line: string): DownloadProgress | null {
		// Parse curl progress output: % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
		//                                Dload  Upload   Total   Spent    Left  Speed
		// Example: 42 34567    42 14567     0     0   1234     0  0:00:28  0:00:12  0:00:16  1456

		const progressMatch = line.match(
			/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+[\d:]+\s+([\d:]+)\s+([\d:]+)\s+(\d+)/
		);

		if (progressMatch) {
			const [, percentage, totalSize, downloadedPercentage, downloadedSize, , , downloadSpeed, , , timeLeft, currentSpeed] =
				progressMatch;

			const timeLeftSeconds = this.parseTimeToSeconds(timeLeft);

			return {
				totalSize: parseInt(totalSize) || undefined,
				downloadedSize: parseInt(downloadedSize),
				downloadSpeed: parseInt(currentSpeed),
				percentage: parseInt(percentage),
				timeRemaining: timeLeftSeconds,
				elapsedTime: 0, // Will be calculated separately
			};
		}

		return null;
	}

	private static parseTimeToSeconds(timeStr: string): number | undefined {
		if (timeStr === '--:--:--') return undefined;

		const parts = timeStr.split(':').map(Number);
		if (parts.length === 3) {
			return parts[0] * 3600 + parts[1] * 60 + parts[2];
		} else if (parts.length === 2) {
			return parts[0] * 60 + parts[1];
		}
		return undefined;
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
		if (options.maxRedirects) args.push('--max-redirs', options.maxRedirects.toString());

		// Timeouts and limits
		if (options.connectTimeout) args.push('--connect-timeout', options.connectTimeout.toString());
		if (options.maxTime) args.push('--max-time', options.maxTime.toString());
		if (options.maxFileSize) args.push('--max-filesize', options.maxFileSize.toString());

		// Retry options
		if (options.retries) {
			args.push('--retry', options.retries.toString());
			if (options.retryDelay) args.push('--retry-delay', options.retryDelay.toString());
		}

		// User agent and referer
		if (options.userAgent) args.push('-A', options.userAgent);
		if (options.referer) args.push('-e', options.referer);

		// Proxy
		if (options.proxy) args.push('--proxy', options.proxy);

		// Resume from position
		if (options.resumeFrom) args.push('-C', options.resumeFrom.toString());

		// Output file
		if (options.outputFile) args.push('-o', options.outputFile);

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

		// Cookies
		if (options.cookies) {
			const cookieString = Object.entries(options.cookies)
				.map(([key, value]) => `${key}=${value}`)
				.join('; ');
			args.push('-b', cookieString);
		}

		// Data
		if (options.data) {
			const data = typeof options.data === 'string' ? options.data : JSON.stringify(options.data);
			args.push('-d', data);

			// Automatically set Content-Type for JSON data if not already set
			if (typeof options.data !== 'string' && (!options.headers || !options.headers['Content-Type'])) {
				if (!options.headers) options.headers = {};
				options.headers['Content-Type'] = 'application/json';
				args.push('-H', 'Content-Type: application/json');
			}
		}

		// Include headers in output (unless outputting to file)
		if (!options.outputFile) args.push('-i');

		// Add verbose output for statistics
		args.push('-w', '@-');
		args.push(
			'--write-out',
			'CURL_STATS_START\\nurl_effective: %{url_effective}\\nhttp_code: %{http_code}\\ntime_total: %{time_total}\\ntime_namelookup: %{time_namelookup}\\ntime_connect: %{time_connect}\\ntime_pretransfer: %{time_pretransfer}\\ntime_starttransfer: %{time_starttransfer}\\nsize_download: %{size_download}\\nsize_upload: %{size_upload}\\nspeed_download: %{speed_download}\\nspeed_upload: %{speed_upload}\\nCURL_STATS_END\\n'
		);

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

			const output = result.stdOut;
			let headers: Record<string, string> = {};
			let body = '';
			let stats: Partial<CurlResponse> = {};

			// Parse statistics from write-out
			const statsMatch = output.match(/CURL_STATS_START\n(.*?)\nCURL_STATS_END/s);
			if (statsMatch) {
				const statsLines = statsMatch[1].split('\n');
				for (const line of statsLines) {
					const [key, value] = line.split(': ');
					switch (key) {
						case 'url_effective':
							stats.finalUrl = value;
							break;
						case 'http_code':
							stats.statusCode = parseInt(value);
							break;
						case 'time_total':
							stats.totalTime = parseFloat(value);
							break;
						case 'size_download':
							stats.downloadSize = parseInt(value);
							break;
						case 'size_upload':
							stats.uploadSize = parseInt(value);
							break;
						case 'speed_download':
							stats.avgDownloadSpeed = parseFloat(value);
							break;
						case 'speed_upload':
							stats.avgUploadSpeed = parseFloat(value);
							break;
					}
				}
			}

			// Parse headers and body if not writing to file
			if (!options.outputFile) {
				const cleanOutput = output.replace(/CURL_STATS_START\n.*?\nCURL_STATS_END\n?/s, '');
				const [headersStr, ...bodyParts] = cleanOutput.split('\r\n\r\n');
				headers = this.parseHeaders(headersStr);
				body = bodyParts.join('\r\n\r\n').trim();
			}

			return {
				success: true,
				statusCode: stats.statusCode || this.parseStatusCode(output),
				headers,
				body,
				raw: result,
				...stats,
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

	/**
	 * Downloads a file with progress tracking
	 */
	static async downloadWithProgress(url: string, options: ProgressiveDownloadOptions): Promise<CurlResponse> {
		try {
			new URL(url);
		} catch (error) {
			return {
				success: false,
				error: 'Invalid URL format',
				raw: { stdOut: '', stdErr: 'Invalid URL format', exitCode: 1 },
			};
		}

		const args: string[] = [];
		const startTime = Date.now();

		// Basic curl options
		if (options.insecure) args.push('-k');
		if (options.compressed) args.push('--compressed');
		if (options.followRedirects !== false) args.push('-L');
		if (options.maxRedirects) args.push('--max-redirs', options.maxRedirects.toString());

		// Progress bar
		args.push('--progress-bar');

		// Output file
		args.push('-o', options.outputPath);

		// Resume if requested
		if (options.resume) args.push('-C', '-');

		// Other options
		if (options.connectTimeout) args.push('--connect-timeout', options.connectTimeout.toString());
		if (options.maxTime) args.push('--max-time', options.maxTime.toString());
		if (options.userAgent) args.push('-A', options.userAgent);
		if (options.referer) args.push('-e', options.referer);
		if (options.proxy) args.push('--proxy', options.proxy);

		// Headers
		if (options.headers) {
			Object.entries(options.headers).forEach(([key, value]) => {
				args.push('-H', `${key}: ${value}`);
			});
		}

		// Cookies
		if (options.cookies) {
			const cookieString = Object.entries(options.cookies)
				.map(([key, value]) => `${key}=${value}`)
				.join('; ');
			args.push('-b', cookieString);
		}

		args.push(url);

		try {
			const process = await spawn('curl', args, {
				timeoutMs: options.timeoutMs,
				cwd: options.cwd,
			});

			let lastProgress: DownloadProgress = {
				downloadedSize: 0,
				downloadSpeed: 0,
				percentage: 0,
				elapsedTime: 0,
			};

			// Listen for stderr output (where curl progress goes)
			process.on('stdErr', (data: string) => {
				const lines = data.split('\n');
				for (const line of lines) {
					if (line.trim()) {
						// Try to parse progress from the line
						const progress = this.parseProgressLine(line);
						if (progress) {
							progress.elapsedTime = (Date.now() - startTime) / 1000;
							lastProgress = progress;
							options.onProgress(progress);
						}
					}
				}
			});

			// Wait for process to complete
			return new Promise<CurlResponse>((resolve) => {
				process.on('exit', (exitCode: number) => {
					if (exitCode === 0) {
						resolve({
							success: true,
							statusCode: 200,
							headers: {},
							body: '',
							raw: { stdOut: '', stdErr: '', exitCode },
							downloadSize: lastProgress.downloadedSize,
							totalTime: lastProgress.elapsedTime,
							avgDownloadSpeed: lastProgress.downloadSpeed,
						});
					} else {
						resolve({
							success: false,
							error: `Download failed with exit code ${exitCode}`,
							raw: { stdOut: '', stdErr: '', exitCode },
						});
					}
				});
			});
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

	static async put(
		url: string,
		data?: CurlOptions['data'],
		options: Omit<CurlOptions, 'method' | 'data'> = {}
	): Promise<CurlResponse> {
		return this.request(url, { ...options, method: 'PUT', data });
	}

	static async delete(url: string, options: Omit<CurlOptions, 'method'> = {}): Promise<CurlResponse> {
		return this.request(url, { ...options, method: 'DELETE' });
	}

	static async patch(
		url: string,
		data?: CurlOptions['data'],
		options: Omit<CurlOptions, 'method' | 'data'> = {}
	): Promise<CurlResponse> {
		return this.request(url, { ...options, method: 'PATCH', data });
	}

	/**
	 * Download a file and return the file path
	 */
	static async download(url: string, outputPath: string, options: Omit<CurlOptions, 'outputFile'> = {}): Promise<CurlResponse> {
		return this.request(url, { ...options, outputFile: outputPath });
	}

	/**
	 * Get file size without downloading
	 */
	static async getFileSize(url: string, options: Omit<CurlOptions, 'method'> = {}): Promise<number | null> {
		const response = await this.head(url, options);
		if (response.success && response.headers) {
			const contentLength = response.headers['content-length'];
			return contentLength ? parseInt(contentLength) : null;
		}
		return null;
	}

	/**
	 * Test download speed to a URL
	 */
	static async testSpeed(url: string, maxTime = 10): Promise<{ downloadSpeed: number; uploadSpeed: number } | null> {
		const response = await this.request(url, { maxTime, outputFile: '/dev/null' });
		if (response.success) {
			return {
				downloadSpeed: response.avgDownloadSpeed || 0,
				uploadSpeed: response.avgUploadSpeed || 0,
			};
		}
		return null;
	}
}
