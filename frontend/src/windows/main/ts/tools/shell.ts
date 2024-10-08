// Safe shell executer & spawn children
import { events, os } from '@neutralinojs/lib';

/**
 * Represents the result of a shell command execution.
 */
interface ExecutionResult {
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
}

/**
 * Escapes a shell argument to prevent command injection.
 * @param arg - The argument to escape.
 * @returns The escaped argument.
 */
function escapeShellArg(arg: string | number): string {
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
 * Interface for the event emitter functionality of spawned processes.
 */
export interface SpawnEventEmitter {
    on(event: 'stdOut' | 'stdErr' | 'exit', listener: (data: string) => void): void;
    off(event: 'stdOut' | 'stdErr' | 'exit', listener: (data: string) => void): void;
}

/**
 * Represents a spawned process with event emitter functionality.
 */
class SpawnedProcess implements SpawnEventEmitter {
    private listeners: { [key: string]: ((data: string) => void)[] } = {
        stdOut: [],
        stdErr: [],
        exit: []
    };

    on(event: 'stdOut' | 'stdErr' | 'exit', listener: (data: string) => void): void {
        this.listeners[event].push(listener);
    }

    off(event: 'stdOut' | 'stdErr' | 'exit', listener: (data: string) => void): void {
        const index = this.listeners[event].indexOf(listener);
        if (index !== -1) {
            this.listeners[event].splice(index, 1);
        }
    }

    emit(event: 'stdOut' | 'stdErr' | 'exit', data: string): void {
        this.listeners[event].forEach(listener => listener(data));
    }
}

// Map to store all active spawned processes
const spawnedProcesses = new Map<number, SpawnedProcess>();

// Global event handler for all spawned processes
events.on('spawnedProcess', (evt: any) => {
    const { id, action, data } = evt.detail;
    const process = spawnedProcesses.get(id);
    if (process) {
        process.emit(action as 'stdOut' | 'stdErr' | 'exit', data);
    }
});

/**
 * Spawns a process using os.spawnProcess with event emitter functionality.
 * @param command - The command to execute.
 * @param args - An array of arguments for the command.
 * @param options - Spawn options.
 * @returns A promise that resolves with the exit code, combined with an event emitter interface.
 * @throws Will throw an error if the process spawn fails or times out.
 */
export function spawn(command: string, args: (string | number)[] = [], options: SpawnOptions = {}): SpawnEventEmitter & Promise<number> {
    const fullCommand = buildCommand(command, args);
    const spawnedProcess = new SpawnedProcess();

    const promise = new Promise<number>((resolve, reject) => {
        let timeoutId: Timer | null = null;

        const handleExit = (exitCode: string) => {
            if (timeoutId) clearTimeout(timeoutId);
            resolve(parseInt(exitCode, 10));
        };

        spawnedProcess.on('exit', handleExit);

        os.spawnProcess(fullCommand, options.cwd)
            .then((process) => {
                spawnedProcesses.set(process.id, spawnedProcess);

                if (options.timeoutMs) {
                    timeoutId = setTimeout(() => {
                        os.updateSpawnedProcess(process.id, 'terminate');
                        spawnedProcesses.delete(process.id);
                        reject(new Error(`Process execution timed out after ${options.timeoutMs}ms`));
                    }, options.timeoutMs);
                }
            })
            .catch((error) => {
                reject(new Error(`Failed to spawn process: ${error.message}`));
            });
    });

    // Combine the SpawnedProcess instance with the Promise
    return Object.assign(spawnedProcess, promise);
}