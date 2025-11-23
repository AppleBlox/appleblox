// Discord RPC wrapper & controller
import { getValue } from '../../components/settings';
import { libraryPath } from '../libraries';
import { buildCommand, spawn, type SpawnEventEmitter } from './shell';
import Logger from '../utils/logger';

const logger = Logger.withContext('RPC');

/**
 * Options for configuring the Discord Rich Presence
 */
export interface RPCOptions {
	/** Your application's client id (Required) */
	clientId: string;
	/** The details string for the presence (Optional) */
	details?: string;
	/** The state string for the presence (Optional) */
	state?: string;
	/** The name of the large image to display (Optional) */
	largeImage?: string;
	/** The text shown when hovering over the large image (Optional) */
	largeImageText?: string;
	/** The name of the small image to display (Optional) */
	smallImage?: string;
	/** The text shown when hovering over the small image (Optional) */
	smallImageText?: string;
	/** The URL for the first button (Optional) */
	buttonUrl1?: string;
	/** The text displayed on the first button (Optional) */
	buttonText1?: string;
	/** The URL for the second button (Optional) */
	buttonUrl2?: string;
	/** The text displayed on the second button (Optional) */
	buttonText2?: string;
	/** The Unix timestamp for when the activity started (Optional) */
	startTime?: number;
	/** The Unix timestamp for when the activity will end (Optional) */
	endTime?: number;
	/** The current and maximum party size, as a tuple [current, max] (Optional) */
	partySize?: [number, number];
	/** The ID of the party (Optional, must be used with partySize) */
	partyId?: string;
	/** The ID of the match (Optional, cannot be used with buttons) */
	matchId?: string;
	/** The join ID of the match (Optional, must be used with matchId) */
	joinId?: string;
	/** The spectate ID of the match (Optional, must be used with matchId) */
	spectateId?: string;
	/** Whether to enable time counting from the current time (Optional) */
	enableTime?: boolean;
	/** Whether to disable colors in the output (Optional) */
	disableColor?: boolean;
}

/**
 * Maps RPCOptions to JSON format expected by the CLI's update mode
 */
interface RPCUpdateJSON {
	state?: string;
	details?: string;
	large_image?: string;
	large_text?: string;
	small_image?: string;
	small_text?: string;
	button_text_1?: string;
	button_url_1?: string;
	button_text_2?: string;
	button_url_2?: string;
	party_size?: [number, number];
	party_id?: string;
	match_id?: string;
	join_id?: string;
	spectate_id?: string;
	enable_time?: boolean;
	start_time?: number;
	end_time?: number;
}

/**
 * Converts RPCOptions to the JSON format expected by CLI update mode
 */
function optionsToUpdateJSON(options: Partial<RPCOptions>): RPCUpdateJSON {
	const json: RPCUpdateJSON = {};

	if (options.state !== undefined) json.state = options.state;
	if (options.details !== undefined) json.details = options.details;
	if (options.largeImage !== undefined) json.large_image = options.largeImage;
	if (options.largeImageText !== undefined) json.large_text = options.largeImageText;
	if (options.smallImage !== undefined) json.small_image = options.smallImage;
	if (options.smallImageText !== undefined) json.small_text = options.smallImageText;
	if (options.buttonText1 !== undefined) json.button_text_1 = options.buttonText1;
	if (options.buttonUrl1 !== undefined) json.button_url_1 = options.buttonUrl1;
	if (options.buttonText2 !== undefined) json.button_text_2 = options.buttonText2;
	if (options.buttonUrl2 !== undefined) json.button_url_2 = options.buttonUrl2;
	if (options.partySize !== undefined) json.party_size = options.partySize;
	if (options.partyId !== undefined) json.party_id = options.partyId;
	if (options.matchId !== undefined) json.match_id = options.matchId;
	if (options.joinId !== undefined) json.join_id = options.joinId;
	if (options.spectateId !== undefined) json.spectate_id = options.spectateId;
	if (options.enableTime !== undefined) json.enable_time = options.enableTime;
	if (options.startTime !== undefined) json.start_time = options.startTime;
	if (options.endTime !== undefined) json.end_time = options.endTime;

	return json;
}

/**
 * Class representing a Discord Rich Presence client
 */
export class DiscordRPC {
	/** Path to the Discord RPC binary */
	private static binaryPath = `${libraryPath('discordrpc')}`;
	/** Set of all DiscordRPC instances */
	private static instances: Set<DiscordRPC> = new Set();
	/** Current RPC process */
	private static rpcProcess: SpawnEventEmitter | null = null;
	/** Current client ID being used */
	private static currentClientId: string | null = null;

	/**
	 * Creates a new DiscordRPC instance
	 */
	constructor() {
		DiscordRPC.instances.add(this);
	}

	/**
	 * Checks if the Discord RPC process is running
	 * @returns Whether the process is running
	 */
	private isRunning(): boolean {
		return DiscordRPC.rpcProcess !== null;
	}

	/**
	 * Starts the Discord RPC process in update mode
	 * @param options - The RPC options
	 * @returns A promise that resolves when the process is started
	 */
	async start(options: RPCOptions): Promise<void> {
		if (!(await getValue('integrations.rpc.enabled'))) return;

		// If already running with same client ID, just update
		if (this.isRunning() && DiscordRPC.currentClientId === options.clientId) {
			logger.info('Already running. Updating options.');
			await this.update(options);
			return;
		}

		// Stop existing process if running with different client ID
		if (this.isRunning()) {
			await this.stop();
		}

		const args = ['-c', options.clientId, '--update'];
		if (options.disableColor) {
			args.push('-C');
		}

		logger.info(`Starting with command: ${buildCommand(DiscordRPC.binaryPath, args)}`);
		
		DiscordRPC.rpcProcess = await spawn(DiscordRPC.binaryPath, args);
		DiscordRPC.currentClientId = options.clientId;

		DiscordRPC.rpcProcess.on('stdErr', (data: string) => {
			logger.error('Process emitted stdErr:', data);
		});

		DiscordRPC.rpcProcess.on('exit', (exitCode: number) => {
			logger.info(`Process exited with code ${exitCode}`);
			DiscordRPC.rpcProcess = null;
			DiscordRPC.currentClientId = null;
		});

		// Send initial update with all options
		await this.update(options);
	}

	/**
	 * Stops the Discord RPC process
	 * @returns A promise that resolves when the process is stopped
	 */
	async stop(): Promise<void> {
		if (DiscordRPC.rpcProcess) {
			try {
				await DiscordRPC.rpcProcess.kill();
			} catch (err) {
				logger.error('Error killing process:', err);
			}
			DiscordRPC.rpcProcess = null;
			DiscordRPC.currentClientId = null;
		}
	}

	/**
	 * Updates the Discord RPC with new options via stdin
	 * @param options - The new RPC options
	 * @returns A promise that resolves when the update is complete
	 */
	async update(options: Partial<RPCOptions>): Promise<void> {
		if (!this.isRunning()) {
			logger.error('Cannot update: RPC process is not running');
			return;
		}

		const updateJSON = optionsToUpdateJSON(options);
		const jsonString = JSON.stringify(updateJSON) + '\n';

		try {
			await DiscordRPC.rpcProcess!.writeStdin(jsonString);
			logger.info('Sent update:', updateJSON);
		} catch (err) {
			logger.error('Error sending update:', err);
		}
	}

	/**
	 * Sets the activity details
	 * @param details - The new details string
	 * @returns A promise that resolves when the update is complete
	 */
	async setDetails(details: string): Promise<void> {
		await this.update({ details });
	}

	/**
	 * Sets the activity state
	 * @param state - The new state string
	 * @returns A promise that resolves when the update is complete
	 */
	async setState(state: string): Promise<void> {
		await this.update({ state });
	}

	/**
	 * Sets the large image and its text
	 * @param imageName - The name of the large image
	 * @param imageText - The text for the large image
	 * @returns A promise that resolves when the update is complete
	 */
	async setLargeImage(imageName: string, imageText?: string): Promise<void> {
		await this.update({ largeImage: imageName, largeImageText: imageText });
	}

	/**
	 * Sets the small image and its text
	 * @param imageName - The name of the small image
	 * @param imageText - The text for the small image
	 * @returns A promise that resolves when the update is complete
	 */
	async setSmallImage(imageName: string, imageText?: string): Promise<void> {
		await this.update({ smallImage: imageName, smallImageText: imageText });
	}

	/**
	 * Sets the buttons for the RPC
	 * @param buttons - An array of button objects with url and text properties
	 * @returns A promise that resolves when the update is complete
	 */
	async setButtons(buttons: Array<{ url: string; text: string }>): Promise<void> {
		const updateOptions: Partial<RPCOptions> = {};
		if (buttons[0]) {
			updateOptions.buttonUrl1 = buttons[0].url;
			updateOptions.buttonText1 = buttons[0].text;
		}
		if (buttons[1]) {
			updateOptions.buttonUrl2 = buttons[1].url;
			updateOptions.buttonText2 = buttons[1].text;
		}
		await this.update(updateOptions);
	}

	/**
	 * Sets the party information
	 * @param size - The current and maximum party size
	 * @param id - The party ID
	 * @returns A promise that resolves when the update is complete
	 */
	async setParty(size: [number, number], id?: string): Promise<void> {
		await this.update({ partySize: size, partyId: id });
	}

	/**
	 * Sets the match information
	 * @param matchId - The match ID
	 * @param joinId - The join ID
	 * @param spectateId - The spectate ID
	 * @returns A promise that resolves when the update is complete
	 */
	async setMatch(matchId: string, joinId?: string, spectateId?: string): Promise<void> {
		await this.update({ matchId, joinId, spectateId });
	}

	/**
	 * Cleans up resources when the instance is no longer needed
	 */
	destroy(): void {
		DiscordRPC.instances.delete(this);
		if (DiscordRPC.instances.size === 0) {
			this.stop().catch(Logger.error);
		}
	}
}

/** Global instance of DiscordRPC */
let discordRPC: DiscordRPC | null = null;

/** Preset RPC options */
const presets: { [key: string]: RPCOptions } = {
	inRobloxApp: {
		clientId: '1257650541677383721',
		details: 'Browsing the app',
		largeImage: 'roblox',
		largeImageText: 'Roblox',
		enableTime: true,
	},
};

/**
 * Controller class for managing Discord RPC
 */
export class RPCController {
	private static lastUpdate: number = 0;
	private static cooldownMs: number = 1000;

	/**
	 * Sets the RPC options to a preset configuration
	 * @param preset - The name of the preset to use
	 */
	public static preset(preset: string): void {
		if (presets[preset]) {
			RPCController.set(presets[preset]);
		}
	}

	/**
	 * Sets the RPC options
	 * @param options - The RPC options to set
	 * @returns A promise that resolves when the RPC is set
	 */
	public static async set(options: RPCOptions): Promise<void> {
		const now = Date.now();
		if (now - RPCController.lastUpdate < RPCController.cooldownMs) {
			logger.info('RPC update ignored due to cooldown');
			return;
		}

		RPCController.lastUpdate = now;

		if (!discordRPC) {
			discordRPC = new DiscordRPC();
		}
		await discordRPC.start(options);
	}

	/**
	 * Stops the RPC
	 * @returns A promise that resolves when the RPC is stopped
	 */
	public static async stop(): Promise<void> {
		if (discordRPC) {
			await discordRPC.stop();
			discordRPC.destroy();
			discordRPC = null;
		}
	}
}