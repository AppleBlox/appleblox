import { os } from '@neutralinojs/lib';
import path from 'path-browserify';
import { Curl } from '../tools/curl';
import { shell } from '../tools/shell';
import shellFS from '../tools/shellfs';
import Logger from '@/windows/main/ts/utils/logger';

/**
 * Binary types supported for Mac downloads
 */
export type MacBinaryType = 'MacPlayer' | 'MacStudio';

/**
 * Architecture types for Mac binaries
 */
export type MacArchitecture = 'intel' | 'apple';

/**
 * Enhanced progress information with download statistics
 */
export interface ProgressInfo {
	/** Progress message */
	message: string;
	/** Progress percentage (0-100) */
	percentage: number;
	/** Downloaded bytes */
	downloadedBytes?: number;
	/** Total file size in bytes */
	totalBytes?: number;
	/** Download speed in bytes per second */
	speed?: number;
	/** Estimated time remaining in seconds */
	timeRemaining?: number;
	/** Human readable download speed */
	speedFormatted?: string;
	/** Human readable downloaded size */
	downloadedFormatted?: string;
	/** Human readable total size */
	totalFormatted?: string;
}

/**
 * Constructor options for RobloxDownloader
 */
export interface RobloxDownloaderOptions {
	/** Channel name (defaults to "LIVE") */
	channel?: string;
	/** Specific version hash (if not provided, fetches latest) */
	version?: string;
	/** Binary type to download */
	binaryType: MacBinaryType;
	/** Architecture type */
	architecture: MacArchitecture;
	/** Progress callback function */
	onProgress?: (progress: ProgressInfo) => void;
	/** Abort signal for cancellation */
	signal?: AbortSignal;
}

/**
 * Client version response from Roblox API
 */
interface ClientVersionResponse {
	version: string;
	clientVersionUpload: string;
	bootstrapperVersion: string;
}

/**
 * Download result containing metadata about the downloaded file
 */
export interface DownloadResult {
	/** Path where the file was saved */
	filePath: string;
	/** Original filename */
	filename: string;
	/** Channel used for download */
	channel: string;
	/** Version downloaded */
	version: string;
	/** Binary type downloaded */
	binaryType: MacBinaryType;
	/** Architecture downloaded */
	architecture: MacArchitecture;
	/** File size in bytes */
	fileSize: number;
	/** Download duration in seconds */
	downloadTime: number;
	/** Average download speed in bytes per second */
	averageSpeed: number;
}

/**
 * RobloxDownloader class for downloading Mac Roblox binaries
 */
export class RobloxDownloader {
	private readonly hostPath = 'https://setup-aws.rbxcdn.com';
	private readonly clientSettingsUrl = 'https://clientsettings.roblox.com/v2/client-version';
	private readonly blobDir: string;
	private readonly channel: string;
	private readonly version?: string;
	private readonly binaryType: MacBinaryType;
	private readonly architecture: MacArchitecture;
	private readonly onProgress: (progress: ProgressInfo) => void;
	private readonly signal?: AbortSignal;
	private downloadStartTime: number = 0;

	/**
	 * Creates a new RobloxDownloader instance with the specified configuration
	 * @param options Configuration options for the downloader
	 */
	constructor(options: RobloxDownloaderOptions) {
		const { channel = 'LIVE', version, binaryType, architecture, onProgress = () => {}, signal } = options;

		this.channel = channel;
		this.version = version;
		this.binaryType = binaryType;
		this.architecture = architecture;
		this.onProgress = onProgress;
		this.signal = signal;
		this.blobDir = architecture === 'intel' ? '/mac' : '/mac/arm64';
	}

	/**
	 * Downloads the configured Roblox Mac binary and saves it to the specified path
	 * @param savePath The full path where the file should be saved (including filename)
	 * @returns Promise resolving to download result
	 */
	async download(savePath: string): Promise<DownloadResult> {
		this.downloadStartTime = Date.now();

		// Validate and prepare save path
		await this.validateAndPreparePath(savePath);

		this.emitProgress({
			message: `Starting download for ${this.binaryType} (${this.architecture}) on ${this.channel}`,
			percentage: 0,
		});

		// Check for cancellation
		this.checkAborted();

		let finalVersion = this.version;
		if (!finalVersion) {
			this.emitProgress({
				message: 'Fetching latest version information...',
				percentage: 5,
			});

			finalVersion = await this.fetchLatestVersion(this.binaryType, this.channel);

			this.emitProgress({
				message: `Retrieved version: ${finalVersion}`,
				percentage: 10,
			});
		} else {
			this.emitProgress({
				message: `Using specified version: ${finalVersion}`,
				percentage: 10,
			});
		}

		this.checkAborted();

		const zipFileName = this.getZipFileName(this.binaryType);
		const downloadUrl = this.buildDownloadUrl(this.channel, finalVersion, zipFileName);

		this.emitProgress({
			message: `Preparing download from Roblox CDN...`,
			percentage: 15,
		});

		// Get file size first for better progress reporting
		let totalSize: number | null = null;
		try {
			totalSize = await Curl.getFileSize(downloadUrl);
			if (totalSize) {
				this.emitProgress({
					message: `File size: ${this.formatBytes(totalSize)} - Starting download...`,
					percentage: 20,
					totalBytes: totalSize,
					totalFormatted: this.formatBytes(totalSize),
				});
			}
		} catch (error) {
			// Continue without file size if we can't get it
			this.emitProgress({
				message: 'Starting download (size unknown)...',
				percentage: 20,
			});
		}

		this.checkAborted();

		const downloadResult = await this.downloadBinaryWithProgress(downloadUrl, savePath, totalSize || undefined);

		const downloadTime = (Date.now() - this.downloadStartTime) / 1000;
		const averageSpeed = downloadResult.fileSize / downloadTime;

		this.emitProgress({
			message: `Download completed successfully in ${downloadTime.toFixed(1)}s`,
			percentage: 100,
			downloadedBytes: downloadResult.fileSize,
			totalBytes: downloadResult.fileSize,
			speed: averageSpeed,
			speedFormatted: `${this.formatBytes(averageSpeed)}/s`,
			downloadedFormatted: this.formatBytes(downloadResult.fileSize),
			totalFormatted: this.formatBytes(downloadResult.fileSize),
		});

		return {
			filePath: savePath,
			filename: zipFileName,
			channel: this.channel,
			version: finalVersion,
			binaryType: this.binaryType,
			architecture: this.architecture,
			fileSize: downloadResult.fileSize,
			downloadTime,
			averageSpeed,
		};
	}

	/**
	 * Validates the save path and creates directories if needed
	 */
	private async validateAndPreparePath(savePath: string): Promise<void> {
		try {
			// Extract directory from the full path
			const pathParts = savePath.split('/');
			pathParts.pop(); // Remove filename
			const directory = pathParts.join('/');

			if (directory) {
				// Check if directory exists, create if it doesn't
				const dirExists = await shellFS.exists(directory);
				if (!dirExists) {
					await shell('mkdir', ['-p', directory]);
					Logger.info(`Created directory: ${directory}`);
				}

				// Check if we can write to the directory
				try {
					await shellFS.writeFile(`${directory}/.write_test`, 'test');
					await shellFS.remove(`${directory}/.write_test`);
				} catch (error) {
					throw new Error(`Cannot write to directory: ${directory}. Check permissions.`);
				}
			}

			// Check if file already exists and remove it
			const fileExists = await shellFS.exists(savePath);
			if (fileExists) {
				await shellFS.remove(savePath);
				Logger.info(`Removed existing file: ${savePath}`);
			}
		} catch (error) {
			throw new Error(`Path validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Downloads binary with real-time progress tracking
	 */
	private async downloadBinaryWithProgress(
		url: string,
		savePath: string,
		expectedSize?: number
	): Promise<{ fileSize: number }> {
		return new Promise((resolve, reject) => {
			Curl.downloadWithProgress(url, {
				outputPath: savePath,
				resume: false,
				followRedirects: true,
				maxRedirects: 5,
				connectTimeout: 30,
				maxTime: 3600,
				expectedSize,
				onProgress: (progress) => {
					this.checkAborted();

					const scaledPercentage = 20 + progress.percentage * 0.8;

					this.emitProgress({
						message: `Downloading... ${progress.percentage.toFixed(1)}%`,
						percentage: scaledPercentage,
						downloadedBytes: progress.downloadedSize,
						totalBytes: progress.totalSize || expectedSize,
						speed: progress.downloadSpeed,
						timeRemaining: progress.timeRemaining,
						speedFormatted: `${this.formatBytes(progress.downloadSpeed)}/s`,
						downloadedFormatted: this.formatBytes(progress.downloadedSize),
						totalFormatted: progress.totalSize
							? this.formatBytes(progress.totalSize)
							: expectedSize
								? this.formatBytes(expectedSize)
								: 'Unknown',
					});
				},
			})
				.then(async (response) => {
					this.checkAborted();

					if (!response.success) {
						reject(new Error(`Download failed: ${response.error || 'Unknown error'}`));
						return;
					}

					this.emitProgress({
						message: 'Verifying downloaded file...',
						percentage: 98,
					});

					// Verify the file was created and get its size
					try {
						const fileExists = await shellFS.exists(savePath);
						if (!fileExists) {
							throw new Error('Downloaded file not found');
						}

						// Get file stats to verify size
						const stats = await shell('stat', ['-f', '%z', savePath]);
						const fileSize = parseInt(stats.stdOut.trim());

						if (fileSize === 0) {
							throw new Error('Downloaded file is empty');
						}

						if (expectedSize && Math.abs(fileSize - expectedSize) > 1024) {
							Logger.warn(`File size mismatch. Expected: ${expectedSize}, Got: ${fileSize}`);
						}

						this.emitProgress({
							message: `File verified: ${this.formatBytes(fileSize)}`,
							percentage: 99,
						});

						resolve({ fileSize });
					} catch (error) {
						reject(
							new Error(`File verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
						);
					}
				})
				.catch((error) => {
					reject(new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
				});
		});
	}

	/**
	 * Fetches the latest version for a given binary type and channel
	 */
	private async fetchLatestVersion(binaryType: MacBinaryType, channel: string): Promise<string> {
		const url = `${this.clientSettingsUrl}/${binaryType}/channel/${channel}`;

		try {
			const response = await Curl.get(url, {
				connectTimeout: 10,
				maxTime: 30,
				retries: 3,
				retryDelay: 1,
			});

			if (!response.success || !response.body) {
				throw new Error(`Failed to fetch version info: ${response.error || 'No response body'}`);
			}

			const versionData: ClientVersionResponse = JSON.parse(response.body);

			if (!versionData.clientVersionUpload) {
				throw new Error('Invalid version response: missing clientVersionUpload');
			}

			return versionData.clientVersionUpload;
		} catch (error) {
			if (error instanceof SyntaxError) {
				throw new Error('Failed to parse version response: Invalid JSON');
			}
			throw new Error(`Version fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Gets the appropriate zip filename for the binary type
	 */
	private getZipFileName(binaryType: MacBinaryType): string {
		switch (binaryType) {
			case 'MacPlayer':
				return 'RobloxPlayer.zip';
			case 'MacStudio':
				return 'RobloxStudioApp.zip';
			default:
				throw new Error(`Unsupported binary type: ${binaryType}`);
		}
	}

	/**
	 * Builds the download URL for the binary
	 */
	private buildDownloadUrl(channel: string, version: string, filename: string): string {
		const normalizedVersion = version.startsWith('version-') ? version : `version-${version}`;
		const channelPath = channel === 'LIVE' ? this.hostPath : `${this.hostPath}/channel/${channel}`;
		return `${channelPath}${this.blobDir}/${normalizedVersion}-${filename}`;
	}

	/**
	 * Formats bytes into human readable format
	 */
	private formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	/**
	 * Emits progress with error handling
	 */
	private emitProgress(progress: ProgressInfo): void {
		try {
			this.onProgress(progress);
		} catch (error) {
			Logger.warn('Progress callback error:', error);
		}
	}

	/**
	 * Checks if the operation was aborted
	 */
	private checkAborted(): void {
		if (this.signal?.aborted) {
			throw new Error('Download was aborted');
		}
	}

	/**
	 * Validates if the provided binary type is supported
	 */
	static isSupportedBinaryType(binaryType: string): binaryType is MacBinaryType {
		return binaryType === 'MacPlayer' || binaryType === 'MacStudio';
	}

	/**
	 * Gets all supported binary types
	 */
	static getSupportedBinaryTypes(): MacBinaryType[] {
		return ['MacPlayer', 'MacStudio'];
	}

	/**
	 * Validates if the provided architecture is supported
	 */
	static isSupportedArchitecture(architecture: string): architecture is MacArchitecture {
		return architecture === 'intel' || architecture === 'apple';
	}

	/**
	 * Gets all supported architectures
	 */
	static getSupportedArchitectures(): MacArchitecture[] {
		return ['intel', 'apple'];
	}

	/**
	 * Moves the downloaded Roblox zip to a correct Applications folder
	 * @param zipPath The path to the RobloxPlayer zip file
	 * @param destName The name of the Roblox application when unzipped, ex: Roblox.app
	 * @throws {Error} The provided zip path doesn't exist, or the unzipped file didn't output a RobloxPlayer.app folder.
	 */
	public async moveToApplicationsFolder(zipPath: string, destName: string) {
		if (!(await shellFS.exists(zipPath))) throw new Error("Couldn't find Roblox zip file at provided file");
		const canWriteToApplicationsFolder = (
			await shell(`[ -w /Applications ] && echo "Writable" || echo "Not writable"`, [], {
				completeCommand: true,
			})
		).stdOut.includes('Writable');
		const applicationsPath = canWriteToApplicationsFolder
			? '/Applications/'
			: path.join(await os.getEnv('HOME'), '/Applications/');
		const destPath = path.join(applicationsPath, destName);
		const dirname = path.dirname(zipPath);
		const robloxAppPath = path.join(dirname, 'RobloxPlayer.app');
		await shellFS.remove(robloxAppPath);
		await shell('unzip', [zipPath, '-d', dirname]);
		await shellFS.remove(destPath);
		await shellFS.move(robloxAppPath, destPath);
		await shell('open', [destPath]);
	}
}
