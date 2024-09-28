// Safe shell executer & spawn children
import { events, os } from '@neutralinojs/lib';

/**
 * Represents the result of a shell command execution.
 */
interface ExecutionResult {
	/** The standard output of the command. */
	stdout: string;
	/** The standard error output of the command. */
	stderr: string;
	/** The exit code of the command. */
	exitCode: number;
}

/**
 * Options for executing shell commands.
 */
export interface ExecuteOptions {
	/** If true, don't throw an error when stderr is not empty. Default is false. */
	skipStderrCheck?: boolean;
	/** The timeout in milliseconds. If provided, the command will be terminated after this time. */
	timeoutMs?: number;
}

/**
 * Escapes a shell argument to prevent command injection.
 * @param arg - The argument to escape.
 * @returns The escaped argument.
 */
function escapeShellArg(arg: string): string {
	return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Builds a safe command string from the command and its arguments.
 * @param command - The main command to execute.
 * @param args - An array of arguments for the command.
 * @returns A properly escaped command string.
 */
export function buildCommand(command: string, args: string[]): string {
	const escapedCommand = escapeShellArg(command);
	const escapedArgs = args.map(escapeShellArg).join(' ');
	return `${escapedCommand} ${escapedArgs}`;
}

/**
 * Executes a shell command safely.
 * @param command - The command to execute.
 * @param args - An optional array of arguments for the command.
 * @param options - Execution options.
 * @returns A promise that resolves with the ExecutionResult.
 * @throws Will throw an error if the command execution fails, times out, or if stderr is not empty (unless skipStderrCheck is true).
 */
export async function shell(command: string, args: string[] = [], options: ExecuteOptions = {}): Promise<ExecutionResult> {
	const fullCommand = buildCommand(command, args);

	const executePromise = new Promise<ExecutionResult>((resolve, reject) => {
		os.execCommand(fullCommand)
			.then((result) => {
				const executionResult: ExecutionResult = {
					stdout: result.stdOut,
					stderr: result.stdErr,
					exitCode: result.exitCode,
				};

				if (!options.skipStderrCheck && (result.stdErr.trim().length > 0 || result.exitCode === 1)) {
					reject(new Error(`Command produced stderr output: ${result.stdErr}`));
				} else {
					resolve(executionResult);
				}
			})
			.catch((error) => {
				console.error(`Error executing command: ${fullCommand}`);
				console.error(error);
				reject(
					new Error(`Command execution failed: ${(error as any).message ? (error as any).message : 'No error message'}`)
				);
			});
	});

	if (options.timeoutMs) {
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => {
				reject(new Error(`Command execution timed out after ${options.timeoutMs}ms`));
			}, options.timeoutMs);
		});

		return Promise.race([executePromise, timeoutPromise]);
	}

	return executePromise;
}

/**
 * Represents the result of a process spawn.
 */
interface SpawnResult {
	/** The standard output of the process. */
	stdout: string;
	/** The standard error output of the process. */
	stderr: string;
	/** The exit code of the process. */
	exitCode: number | null;
}

/**
 * Options for spawning processes.
 */
export interface SpawnOptions {
	/** If true, don't throw an error when stderr is not empty. Default is false. */
	skipStderrCheck?: boolean;
	/** The timeout in milliseconds. If provided, the process will be terminated after this time. */
	timeoutMs?: number;
	/** The current working directory for the spawned process. */
	cwd?: string;
}

/**
 * Spawns a process using os.spawnProcess.
 * @param command - The command to execute.
 * @param options - Spawn options.
 * @returns A promise that resolves with the SpawnResult.
 * @throws Will throw an error if the process spawn fails, times out, or if stderr is not empty (unless skipStderrCheck is true).
 */
export function spawn(command: string, args: string[] = [], options: SpawnOptions = {}): Promise<SpawnResult> {
	return new Promise<SpawnResult>((resolve, reject) => {
		const fullCommand = buildCommand(command, args);
		let stdout = '';
		let stderr = '';
		let exitCode: number | null = null;
		let timeoutId: Timer | null = null;

		const cleanup = (processHandler: (evt: any) => void) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			events.off('spawnedProcess', processHandler);
		};

		const handleProcessEnd = (processHandler: (evt: any) => void) => {
			cleanup(processHandler);
			if (!options.skipStderrCheck && stderr.trim().length > 0) {
				reject(new Error(`Process produced stderr output: ${stderr}`));
			} else {
				resolve({ stdout, stderr, exitCode });
			}
		};

		os.spawnProcess(fullCommand, options.cwd)
			.then((process) => {
				const processHandler = (evt: any) => {
					if (process.id === evt.detail.id) {
						switch (evt.detail.action) {
							case 'stdOut':
								stdout += evt.detail.data;
								break;
							case 'stdErr':
								stderr += evt.detail.data;
								break;
							case 'exit':
								exitCode = parseInt(evt.detail.data, 10);
								handleProcessEnd(processHandler);
								break;
						}
					}
				};

				events.on('spawnedProcess', processHandler);

				if (options.timeoutMs) {
					timeoutId = setTimeout(() => {
						os.updateSpawnedProcess(process.id, 'terminate');
						cleanup(processHandler);
						reject(new Error(`Process execution timed out after ${options.timeoutMs}ms`));
					}, options.timeoutMs);
				}
			})
			.catch((error) => {
				reject(new Error(`Failed to spawn process: ${error.message}`));
			});
	});
}
