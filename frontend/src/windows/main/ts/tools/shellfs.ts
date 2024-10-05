import { shell, type ExecuteOptions } from './shell';

/**
 * Creates the folder at the specified path.
 * @param path - The path where the folder should be created.
 * @param options - Execution options.
 */
export async function createDirectory(path: string, options: ExecuteOptions = {}): Promise<void> {
	await shell('mkdir', ['-p', path], options);
}

/**
 * Removes the file or folder at the specified path.
 * @param path - The path of the file or folder to remove.
 * @param options - Execution options.
 */
export async function remove(path: string, options: ExecuteOptions = {}): Promise<void> {
	await shell('rm', ['-rf', path], options);
}

/**
 * Writes the file at the specified path with the given content.
 * @param path - The path where the file should be written.
 * @param content - The content to write to the file.
 * @param options - Execution options.
 */
export async function writeFile(path: string, content: string, options: ExecuteOptions = {}): Promise<void> {
	await shell('bash', ['-c', `echo "${content.replace(/"/g, '\\"')}" > "${path}"`], options);
}

/**
 * Copy the file/folder at the specified path.
 * @param source - The path where the source is.
 * @param dest - Where to copy.
 * @param recursive - Whether to copy recursively. Default is false.
 * @param options - Execution options.
 */
export async function copy(source: string, dest: string, recursive = false, options: ExecuteOptions = {}): Promise<void> {
	const args = recursive ? ['-r', source, dest] : [source, dest];
	await shell('cp', args, options);
}

/**
 * Move the file/folder at the specified path.
 * @param source - The path where the source is.
 * @param dest - Where to move.
 * @param options - Execution options.
 */
export async function move(source: string, dest: string, options: ExecuteOptions = {}): Promise<void> {
	await shell('mv', [source, dest], options);
}

/**
 * Merge the file/folder at the specified path.
 * @param source - The path where the source is.
 * @param dest - Where to merge.
 * @param options - Execution options.
 */
export async function merge(source: string, dest: string, options: ExecuteOptions = {}): Promise<void> {
	await shell('rsync', ['-a', source, dest], options);
}

/**
 * Read the contents of a file.
 * @param path - The path of the file to read.
 * @param options - Execution options.
 * @returns The content of the file as a string.
 */
export async function readFile(path: string, options: ExecuteOptions = {}): Promise<string> {
	const result = await shell('cat', [path], options);
	return result.stdOut.trim();
}

/**
 * List the contents of a directory.
 * @param path - The path of the directory to list.
 * @param options - Execution options.
 * @returns An array of file and directory names in the specified path.
 */
export async function listDirectory(path: string, options: ExecuteOptions = {}): Promise<string[]> {
	const result = await shell('ls', ['-1', path], options);
	return result.stdOut.trim().split('\n');
}

/**
 * Check if a file or directory exists.
 * @param path - The path to check.
 * @param options - Execution options.
 * @returns True if the path exists, false otherwise.
 */
export async function exists(path: string, options: ExecuteOptions = {}): Promise<boolean> {
	try {
		await shell('test', ['-e', path], { ...options });
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
export async function getInfo(path: string, options: ExecuteOptions = {}): Promise<{ [key: string]: string } | null> {
	const result = await shell('stat', ['-f', '%N,%z,%f,%u,%g,%Sp,%m', path], {
		...options,
		skipStderrCheck: true,
	});
	if (result.exitCode === 1 || result.stdErr.trim().includes('No such file or directory')) {
		return null;
	} else if (result.stdErr.length > 0) {
		console.error('Error while getting path info:', result.stdErr);
	}
	const [name, size, mode, uid, gid, permissions, modTime] = result.stdOut.trim().split(',');
	return { name, size, mode, uid, gid, permissions, modTime };
}

/**
 * Options for the open command.
 */
export interface OpenOptions extends ExecuteOptions {
	/** Open the file with TextEdit (-e) */
	editInTextEdit?: boolean;
	/** Open the file with default text editor (-t) */
	openInDefaultTextEditor?: boolean;
	/** Read input from standard input and open with TextEdit (-f) */
	readStdin?: boolean;
	/** Open the application "fresh," without restoring windows (-F) */
	freshInstance?: boolean;
	/** Wait for the application to terminate before returning (-W) */
	wait?: boolean;
	/** Reveal the file in the Finder instead of opening it (-R) */
	reveal?: boolean;
	/** Open a new instance of the application (-n) */
	newInstance?: boolean;
	/** Do not bring the application to the foreground (-g) */
	background?: boolean;
	/** Launch the app hidden (-j) */
	hidden?: boolean;
	/** Search for and open the header file (-h) */
	openHeaderFile?: boolean;
	/** URL to open (-u) */
	url?: string;
	/** SDK to use (-s) */
	sdk?: string;
	/** Bundle identifier of the application to open (-b) */
	bundleIdentifier?: string;
	/** Application to use for opening the file (-a) */
	application?: string;
	/** Environment variables to set (--env) */
	env?: Record<string, string>;
	/** Path to redirect stderr (--stderr) */
	stderr?: string;
	/** Path to redirect stdin (--stdin) */
	stdin?: string;
	/** Path to redirect stdout (--stdout) */
	stdout?: string;
	/** Architecture to use (--arch) */
	architecture?: string;
	/** Additional arguments to pass to the application (--args) */
	args?: string[];
}

/**
 * Opens the file or directory at the specified path.
 * @param path - The path of the file or directory to open.
 * @param options - Options for the open command and execution.
 * @param options.editInTextEdit - Open the file with TextEdit (-e)
 * @param options.openInDefaultTextEditor - Open the file with default text editor (-t)
 * @param options.readStdin - Read input from standard input and open with TextEdit (-f)
 * @param options.freshInstance - Open the application "fresh," without restoring windows (-F)
 * @param options.wait - Wait for the application to terminate before returning (-W)
 * @param options.reveal - Reveal the file in the Finder instead of opening it (-R)
 * @param options.newInstance - Open a new instance of the application (-n)
 * @param options.background - Do not bring the application to the foreground (-g)
 * @param options.hidden - Launch the app hidden (-j)
 * @param options.openHeaderFile - Search for and open the header file (-h)
 * @param options.url - URL to open (-u)
 * @param options.sdk - SDK to use (-s)
 * @param options.bundleIdentifier - Bundle identifier of the application to open (-b)
 * @param options.application - Application to use for opening the file (-a)
 * @param options.env - Environment variables to set (--env)
 * @param options.stderr - Path to redirect stderr (--stderr)
 * @param options.stdin - Path to redirect stdin (--stdin)
 * @param options.stdout - Path to redirect stdout (--stdout)
 * @param options.architecture - Architecture to use (--arch)
 * @param options.args - Additional arguments to pass to the application (--args)
 */
export async function open(path: string, options: OpenOptions = {}): Promise<void> {
	const args: string[] = [];

	if (options.editInTextEdit) args.push('-e');
	if (options.openInDefaultTextEditor) args.push('-t');
	if (options.readStdin) args.push('-f');
	if (options.freshInstance) args.push('-F');
	if (options.wait) args.push('-W');
	if (options.reveal) args.push('-R');
	if (options.newInstance) args.push('-n');
	if (options.background) args.push('-g');
	if (options.hidden) args.push('-j');
	if (options.openHeaderFile) args.push('-h');
	if (options.url) args.push('-u', options.url);
	if (options.sdk) args.push('-s', options.sdk);
	if (options.bundleIdentifier) args.push('-b', options.bundleIdentifier);
	if (options.application) args.push('-a', options.application);
	if (options.env) {
		Object.entries(options.env).forEach(([key, value]) => {
			args.push('--env', `${key}=${value}`);
		});
	}
	if (options.stderr) args.push('--stderr', options.stderr);
	if (options.stdin) args.push('--stdin', options.stdin);
	if (options.stdout) args.push('--stdout', options.stdout);
	if (options.architecture) args.push('--arch', options.architecture);

	args.push(path);

	if (options.args) {
		args.push('--args', ...options.args);
	}

	await shell('open', args, options);
}

type PermissionTarget = 'u' | 'g' | 'o' | 'a';
export interface ChmodOptions extends ExecuteOptions {
	/** Apply changes recursively to directories and their contents (-R) */
	recursive?: boolean;
	/** Use the numeric mode specification */
	numeric?: boolean;
	/** Change the file mode bits of the symbolic link itself, not the file it points to (-h) */
	modifySymlink?: boolean;
	/** Use silent mode; suppress most error messages (-f) */
	silent?: boolean;
	/** Display information about the changes made (-v) */
	verbose?: boolean;
	/** Don't change any file modes; useful for testing (-n) */
	dryRun?: boolean;
	/** Change the user ID of the file (-u) */
	setUserId?: boolean;
	/** Change the group ID of the file (-g) */
	setGroupId?: boolean;
	/** Set the sticky bit (-t) */
	setSticky?: boolean;
	/** Remove read permission (u-r, g-r, o-r, a-r) */
	removeRead?: PermissionTarget;
	/** Remove write permission (u-w, g-w, o-w, a-w) */
	removeWrite?: PermissionTarget;
	/** Remove execute permission (u-x, g-x, o-x, a-x) */
	removeExecute?: PermissionTarget;
	/** Add read permission (u+r, g+r, o+r, a+r) */
	addRead?: PermissionTarget;
	/** Add write permission (u+w, g+w, o+w, a+w) */
	addWrite?: PermissionTarget;
	/** Add execute permission (u+x, g+x, o+x, a+x) */
	addExecute?: PermissionTarget;
}

/**
 * Change the mode of a file or directory.
 * @param path - The path of the file or directory to modify.
 * @param mode - The mode to set. Can be a numeric string (e.g., "755") or a symbolic string (e.g., "u+x").
 * @param options - Options for the chmod command and execution.
 */
export async function chmod(path: string, mode: string, options: ChmodOptions = {}): Promise<void> {
	const args: string[] = [];

	if (options.recursive) args.push('-R');
	if (options.modifySymlink) args.push('-h');
	if (options.silent) args.push('-f');
	if (options.verbose) args.push('-v');
	if (options.dryRun) args.push('-n');

	if (options.numeric) {
		args.push(mode);
	} else {
		let symbolicMode = '';

		const applyPermission = (type: PermissionTarget, action: '+' | '-', permission: 'r' | 'w' | 'x') => {
			symbolicMode += `${type}${action}${permission},`;
		};

		if (options.setUserId) symbolicMode += 'u+s,';
		if (options.setGroupId) symbolicMode += 'g+s,';
		if (options.setSticky) symbolicMode += '+t,';

		if (options.removeRead) applyPermission(options.removeRead, '-', 'r');
		if (options.removeWrite) applyPermission(options.removeWrite, '-', 'w');
		if (options.removeExecute) applyPermission(options.removeExecute, '-', 'x');
		if (options.addRead) applyPermission(options.addRead, '+', 'r');
		if (options.addWrite) applyPermission(options.addWrite, '+', 'w');
		if (options.addExecute) applyPermission(options.addExecute, '+', 'x');

		if (symbolicMode) {
			args.push(symbolicMode.slice(0, -1)); // Remove trailing comma
		} else {
			args.push(mode);
		}
	}

	args.push(path);

	await shell('chmod', args, options);
}

// Default export containing all functions
const shellFS = {
	createDirectory,
	remove,
	writeFile,
	copy,
	move,
	merge,
	readFile,
	listDirectory,
	exists,
	getInfo,
	open,
	chmod
};

export default shellFS;
