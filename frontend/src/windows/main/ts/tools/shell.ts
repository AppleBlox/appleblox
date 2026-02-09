// Safe shell executer & spawn children
import { events, os } from '@neutralinojs/lib';
import Logger from '@/windows/main/ts/utils/logger';

/**
 * Represents the result of a shell command execution.
 */
export interface ExecutionResult {
	/** The standard output of the command. */
	stdOut: string;
	/** The standard error output of the command. */
	stdErr: string;
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
	/** If true, the command will be treated as a "whole" command and args will be ignored */
	completeCommand?: boolean;
	/** Pass this argument to neutralino's os.execCommand function */
	background?: boolean;
	/** Directory from which to execute the command */
	cwd?: string;
	/** Named secrets to inject via stdin. Keys are variable names (used as $VAR_NAME in command), values are secret data. */
	secrets?: Record<string, string>;
}

/**
 * Escapes a shell argument to prevent command injection.
 * @param arg - The argument to escape.
 * @returns The escaped argument.
 */
export function escapeShellArg(arg: string | number): string {
	return `'${arg.toString().replace(/'/g, "'\\''")}'`;
}

/**
 * Builds a safe command string from the command and its arguments.
 * @param command - The main command to execute.
 * @param args - An array of arguments for the command.
 * @returns A properly escaped command string.
 */
export function buildCommand(command: string, args: (string | number)[]): string {
	const escapedCommand = escapeShellArg(command);
	const escapedArgs = args.map(escapeShellArg).join(' ');
	return `${escapedCommand} ${escapedArgs}`;
}

/**
 * Builds a command with secrets injected via read -s.
 * @param command - The command template with $VAR_NAME placeholders.
 * @param secrets - Record of variable names to secret values.
 * @returns The complete command string with read -s statements.
 */
function buildCommandWithSecrets(command: string, secrets: Record<string, string>): string {
	const readStatements = Object.keys(secrets)
		.map(varName => `read -s ${varName}`)
		.join('; ');
	
	return `${readStatements}; ${command}`;
}

/**
 * Executes a shell command safely.
 * @param command - The command to execute.
 * @param args - An optional array of arguments for the command.
 * @param options - Execution options.
 * @returns A promise that resolves with the ExecutionResult.
 * @throws Will throw an error if the command execution fails, times out, or if stderr is not empty (unless skipStderrCheck is true).
 */
export async function shell(
	command: string,
	args: (string | number)[] = [],
	options: ExecuteOptions = {}
): Promise<ExecutionResult> {
	// If secrets are provided, use spawn() under the hood
	if (options.secrets && Object.keys(options.secrets).length > 0) {
		const fullCommand = options.completeCommand ? command : buildCommand(command, args);
		const commandWithSecrets = buildCommandWithSecrets(fullCommand, options.secrets);
		
		return new Promise<ExecutionResult>(async (resolve, reject) => {
			let stdOut = '';
			let stdErr = '';
			let exitCode = 0;
			let timeoutId: NodeJS.Timeout | null = null;

			try {
				const process = await spawn('sh', ['-c', commandWithSecrets], {
					skipStderrCheck: options.skipStderrCheck,
					cwd: options.cwd,
					completeCommand: false
				});

				process.on('stdOut', (data) => {
					stdOut += data;
				});

				process.on('stdErr', (data) => {
					stdErr += data;
				});

				process.on('exit', (code) => {
					if (timeoutId) clearTimeout(timeoutId);
					exitCode = code;

					const result: ExecutionResult = { stdOut, stdErr, exitCode };

					if (!options.skipStderrCheck && (stdErr.trim().length > 0 || exitCode === 1)) {
						reject(new Error(`Command produced stderr output: ${stdErr}`));
					} else {
						resolve(result);
					}
				});

				// Write secrets to stdin in order
				for (const secretValue of Object.values(options.secrets!)) {
					await process.writeStdin(secretValue + '\n');
				}
				await process.endStdin();

				if (options.timeoutMs) {
					timeoutId = setTimeout(async () => {
						await process.kill(true);
						reject(new Error(`Command execution timed out after ${options.timeoutMs}ms`));
					}, options.timeoutMs);
				}
			} catch (error) {
				if (timeoutId) clearTimeout(timeoutId);
				reject(error);
			}
		});
	}

	// Original implementation without secrets
	const fullCommand = options.completeCommand ? command : buildCommand(command, args);

	const executePromise = new Promise<ExecutionResult>((resolve, reject) => {
		os.execCommand(fullCommand, { background: options.background === true, cwd: options.cwd })
			.then((result) => {
				const executionResult: ExecutionResult = {
					stdOut: result.stdOut,
					stdErr: result.stdErr,
					exitCode: result.exitCode,
				};

				if (!options.skipStderrCheck && (result.stdErr.trim().length > 0 || result.exitCode === 1)) {
					reject(new Error(`${fullCommand}\nCommand produced stderr output: ${result.stdErr}`));
				} else {
					resolve(executionResult);
				}
			})
			.catch((error) => {
				Logger.error(`Error executing command: ${fullCommand}`);
				Logger.error(error);
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
 * Options for spawning processes.
 */
export interface SpawnOptions {
	/** If true, don't throw an error when stderr is not empty. Default is false. */
	skipStderrCheck?: boolean;
	/** The timeout in milliseconds. If provided, the process will be terminated after this time. */
	timeoutMs?: number;
	/** The current working directory for the spawned process. */
	cwd?: string;
	/** If true, the command will be treated as a "whole" command and args will be ignored */
	completeCommand?: boolean;
	/** List of environnment variables to apply */
	envs?: Record<string, string>;
	/** Named secrets to inject via stdin. Keys are variable names (used as $VAR_NAME in command), values are secret data. */
	secrets?: Record<string, string>;
}

/**
 * Interface for the event emitter functionality of spawned processes.
 */
export interface SpawnEventEmitter {
	/**
	 * Adds a listener for the specified event.
	 * @param event - The event to listen for ('stdOut' or 'stdErr').
	 * @param listener - The callback function to execute when the event occurs.
	 */
	on(event: 'stdOut' | 'stdErr', listener: (data: string) => void): void;
	/**
	 * Adds a listener for the exit event.
	 * @param event - The 'exit' event.
	 * @param listener - The callback function to execute when the process exits.
	 */
	on(event: 'exit', listener: (exitCode: number) => void): void;
	/**
	 * Removes a listener for the specified event.
	 * @param event - The event to stop listening for ('stdOut' or 'stdErr').
	 * @param listener - The callback function to remove.
	 */
	off(event: 'stdOut' | 'stdErr', listener: (data: string) => void): void;
	/**
	 * Removes a listener for the exit event.
	 * @param event - The 'exit' event.
	 * @param listener - The callback function to remove.
	 */
	off(event: 'exit', listener: (exitCode: number) => void): void;
	/** The process ID of the spawned process. */
	pid: number | null;
	/** The Neutralino process ID */
	processId: number | null;
	/**
	 * Writes data to the stdin of the spawned process.
	 * @param data - The data to write to stdin.
	 * @returns A promise that resolves when the write operation is complete.
	 */
	writeStdin(data: string): Promise<void>;
	/**
	 * Signals the end of stdin input for the spawned process.
	 * @returns A promise that resolves when the end of stdin is signaled.
	 */
	endStdin(): Promise<void>;
	/**
	 * Kills the spawned process.
	 * @param force Force quit the process
	 * @throws Will throw an error if the process PID is not available.
	 */
	kill(force?: boolean): Promise<void>;
}

/**
 * Represents a spawned process with event emitter functionality.
 */
class SpawnedProcess implements SpawnEventEmitter {
	private listeners: { [key: string]: ((data: string | number) => void)[] } = {
		stdOut: [],
		stdErr: [],
		exit: [],
	};
	pid: number;
	processId: number;

	constructor(pid: number, processId: number) {
		this.pid = pid;
		this.processId = processId;
	}

	on(event: 'stdOut' | 'stdErr', listener: (data: string) => void): void;
	on(event: 'exit', listener: (exitCode: number) => void): void;
	on(event: 'stdOut' | 'stdErr' | 'exit', listener: ((data: string) => void) | ((exitCode: number) => void)): void {
		this.listeners[event].push(listener as any);
	}

	off(event: 'stdOut' | 'stdErr', listener: (data: string) => void): void;
	off(event: 'exit', listener: (exitCode: number) => void): void;
	off(event: 'stdOut' | 'stdErr' | 'exit', listener: ((data: string) => void) | ((exitCode: number) => void)): void {
		const index = this.listeners[event].indexOf(listener as any);
		if (index !== -1) {
			this.listeners[event].splice(index, 1);
		}
	}

	emit(event: 'stdOut' | 'stdErr', data: string): void;
	emit(event: 'exit', exitCode: number): void;
	emit(event: 'stdOut' | 'stdErr' | 'exit', data: string | number): void {
		this.listeners[event].forEach((listener) => listener(data));
	}

	async writeStdin(data: string): Promise<void> {
		await os.updateSpawnedProcess(this.processId, 'stdIn', data);
	}

	async endStdin(): Promise<void> {
		await os.updateSpawnedProcess(this.processId, 'stdInEnd');
	}

	async kill(force = false): Promise<void> {
		await shell('kill', force ? ['-9', this.pid.toString()] : [this.pid.toString()], { skipStderrCheck: true });
	}
}

// Map to store all active spawned processes
const spawnedProcesses = new Map<number, SpawnedProcess>();

// Global event handler for all spawned processes
events.on('spawnedProcess', (evt: any) => {
	const { id, action, data } = evt.detail;
	const process = spawnedProcesses.get(id);
	if (process) {
		if (action === 'exit') {
			process.emit(action, parseInt(data, 10));
		} else {
			process.emit(action as 'stdOut' | 'stdErr', data);
		}
	}
});

/**
 * Spawns a process using os.spawnProcess with event emitter functionality.
 * @param command - The command to execute.
 * @param args - An array of arguments for the command.
 * @param options - Spawn options.
 * @returns A Promise that resolves to a SpawnEventEmitter that allows interaction with the spawned process.
 * @throws Will throw an error if the process spawn fails or times out.
 */
export async function spawn(
	command: string,
	args: (string | number)[] = [],
	options: SpawnOptions = {}
): Promise<SpawnEventEmitter> {
	let fullCommand: string;
	let secretsToWrite: string[] | null = null;

	// If secrets are provided, build command with read -s statements
	if (options.secrets && Object.keys(options.secrets).length > 0) {
		const baseCommand = options.completeCommand ? command : buildCommand(command, args);
		fullCommand = buildCommandWithSecrets(baseCommand, options.secrets);
		secretsToWrite = Object.values(options.secrets);
	} else {
		fullCommand = options.completeCommand ? command : buildCommand(command, args);
	}

	let timeoutId: NodeJS.Timeout | null = null;

	try {
		const process = await os.spawnProcess(fullCommand, { cwd: options.cwd, envs: options.envs });
		const spawnedProcess = new SpawnedProcess(process.pid, process.id);
		spawnedProcesses.set(process.id, spawnedProcess);

		const handleExit = () => {
			if (timeoutId) clearTimeout(timeoutId);
			spawnedProcesses.delete(process.id);
		};

		spawnedProcess.on('exit', handleExit);

		if (options.timeoutMs) {
			timeoutId = setTimeout(async () => {
				await os.updateSpawnedProcess(process.id, 'terminate');
				spawnedProcesses.delete(process.id);
				throw new Error(`Process execution timed out after ${options.timeoutMs}ms`);
			}, options.timeoutMs);
		}

		// If secrets were provided, write them to stdin immediately
		if (secretsToWrite) {
			for (const secret of secretsToWrite) {
				await spawnedProcess.writeStdin(secret + '\n');
			}
			await spawnedProcess.endStdin();
		}

		return spawnedProcess;
	} catch (error) {
		throw new Error(`Failed to spawn process: ${(error as Error).message}`);
	}
}