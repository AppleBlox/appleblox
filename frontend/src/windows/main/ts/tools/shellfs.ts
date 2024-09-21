// Shell based commands filesystem utilites
import { shell, type ExecuteOptions } from './shell';

class ShellFS {
	private static async executeCommand(command: string, args: string[] = [], options: ExecuteOptions = {}): Promise<void> {
		try {
			const result = await shell(command, args, options);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed with exit code ${result.exitCode}: ${result.stderr}`);
			}
		} catch (err) {
			console.error(`Error executing command: ${command} ${args.join(' ')}`);
			console.error(err);
			throw err;
		}
	}

	/**
	 * Creates the folder at the specified path.
	 * @param path - The path where the folder should be created.
	 * @param options - Execution options.
	 */
	public static async createDirectory(path: string, options: ExecuteOptions = {}): Promise<void> {
		await this.executeCommand('mkdir', ['-p', path], options);
	}

	/**
	 * Removes the file or folder at the specified path.
	 * @param path - The path of the file or folder to remove.
	 * @param options - Execution options.
	 */
	public static async remove(path: string, options: ExecuteOptions = {}): Promise<void> {
		await this.executeCommand('rm', ['-rf', path], options);
	}

	/**
	 * Writes the file at the specified path with the given content.
	 * @param path - The path where the file should be written.
	 * @param content - The content to write to the file.
	 * @param options - Execution options.
	 */
	public static async writeFile(path: string, content: string, options: ExecuteOptions = {}): Promise<void> {
		await this.executeCommand('bash', ['-c', `echo "${content.replace(/"/g, '\\"')}" > "${path}"`], options);
	}

	/**
	 * Copy the file/folder at the specified path.
	 * @param source - The path where the source is.
	 * @param dest - Where to copy.
	 * @param recursive - Whether to copy recursively. Default is false.
	 * @param options - Execution options.
	 */
	public static async copy(source: string, dest: string, recursive = false, options: ExecuteOptions = {}): Promise<void> {
		const args = recursive ? ['-r', source, dest] : [source, dest];
		await this.executeCommand('cp', args, options);
	}

	/**
	 * Move the file/folder at the specified path.
	 * @param source - The path where the source is.
	 * @param dest - Where to move.
	 * @param options - Execution options.
	 */
	public static async move(source: string, dest: string, options: ExecuteOptions = {}): Promise<void> {
		await this.executeCommand('mv', [source, dest], options);
	}

	/**
	 * Merge the file/folder at the specified path.
	 * @param source - The path where the source is.
	 * @param dest - Where to merge.
	 * @param options - Execution options.
	 */
	public static async merge(source: string, dest: string, options: ExecuteOptions = {}): Promise<void> {
		await this.executeCommand('rsync', ['-a', source, dest], options);
	}

	/**
	 * Read the contents of a file.
	 * @param path - The path of the file to read.
	 * @param options - Execution options.
	 * @returns The content of the file as a string.
	 */
	public static async readFile(path: string, options: ExecuteOptions = {}): Promise<string> {
		const result = await shell('cat', [path], options);
		return result.stdout.trim();
	}

	/**
	 * List the contents of a directory.
	 * @param path - The path of the directory to list.
	 * @param options - Execution options.
	 * @returns An array of file and directory names in the specified path.
	 */
	public static async listDirectory(path: string, options: ExecuteOptions = {}): Promise<string[]> {
		const result = await shell('ls', ['-1', path], options);
		return result.stdout.trim().split('\n');
	}

	/**
	 * Check if a file or directory exists.
	 * @param path - The path to check.
	 * @param options - Execution options.
	 * @returns True if the path exists, false otherwise.
	 */
	public static async exists(path: string, options: ExecuteOptions = {}): Promise<boolean> {
		try {
			await this.executeCommand('test', ['-e', path], { ...options, skipStderrCheck: true });
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Get file or directory information.
	 * @param path - The path to get information for.
	 * @param options - Execution options.
	 * @returns An object containing file information (size, permissions, etc.).
	 */
	public static async getInfo(path: string, options: ExecuteOptions = {}): Promise<{ [key: string]: string }> {
		const result = await shell('stat', ['-c', '%n,%s,%f,%u,%g,%A,%Y', path], options);
		const [name, size, mode, uid, gid, permissions, modTime] = result.stdout.trim().split(',');
		return { name, size, mode, uid, gid, permissions, modTime };
	}
}

export default ShellFS;
