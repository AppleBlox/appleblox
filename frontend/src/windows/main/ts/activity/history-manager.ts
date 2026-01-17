import { filesystem } from '@neutralinojs/lib';
import path from 'path-browserify';
import shellFS from '../tools/shellfs';
import { getDataDir } from '../utils/paths';
import Logger from '../utils/logger';
import type { GameHistoryEntry, ServerInfo, AddGameEntryOptions } from './types';

const MAX_GAMES = 30;
const MAX_SERVERS_PER_GAME = 10;
const HISTORY_FILE = 'activity-history.json';

/**
 * Activity History Manager
 * Handles persistence and management of game/server history
 */
class ActivityHistoryManagerClass {
	private history: GameHistoryEntry[] = [];
	private loaded = false;

	/**
	 * Get the path to the history file
	 */
	private async getHistoryPath(): Promise<string> {
		const dataDir = await getDataDir();
		return path.join(dataDir, HISTORY_FILE);
	}

	/**
	 * Load history from disk
	 */
	async load(): Promise<GameHistoryEntry[]> {
		try {
			const historyPath = await this.getHistoryPath();
			const exists = await shellFS.exists(historyPath);

			if (!exists) {
				this.history = [];
				this.loaded = true;
				return this.history;
			}

			const content = await filesystem.readFile(historyPath);
			this.history = JSON.parse(content);
			this.loaded = true;
			Logger.info(`Loaded ${this.history.length} games from activity history`);
			return this.history;
		} catch (error) {
			Logger.error('Failed to load activity history:', error);
			this.history = [];
			this.loaded = true;
			return this.history;
		}
	}

	/**
	 * Save history to disk
	 */
	async save(): Promise<void> {
		try {
			const historyPath = await this.getHistoryPath();
			const dataDir = await getDataDir();

			// Ensure directory exists
			if (!(await shellFS.exists(dataDir))) {
				await filesystem.createDirectory(dataDir);
			}

			// Write the history file
			const content = JSON.stringify(this.history, null, 2);
			await filesystem.writeFile(historyPath, content);

			Logger.debug('Activity history saved');
		} catch (error) {
			Logger.error('Failed to save activity history:', error);
		}
	}

	/**
	 * Ensure history is loaded
	 */
	private async ensureLoaded(): Promise<void> {
		if (!this.loaded) {
			await this.load();
		}
	}

	/**
	 * Add or update a game entry in the history
	 * Moves the game to the front if it already exists
	 */
	async addGameEntry(options: AddGameEntryOptions): Promise<void> {
		await this.ensureLoaded();

		const { placeId, universeId, name, creator, iconUrl, lastPlayed } = options;

		// Find existing entry
		const existingIndex = this.history.findIndex((entry) => entry.placeId === placeId);

		if (existingIndex !== -1) {
			// Update existing entry and move to front
			const existing = this.history[existingIndex];
			existing.name = name;
			existing.creator = creator;
			existing.iconUrl = iconUrl;
			existing.lastPlayed = lastPlayed;
			existing.universeId = universeId;

			// Move to front
			this.history.splice(existingIndex, 1);
			this.history.unshift(existing);
		} else {
			// Add new entry at front
			const newEntry: GameHistoryEntry = {
				placeId,
				universeId,
				name,
				creator,
				iconUrl,
				lastPlayed,
				servers: [],
			};
			this.history.unshift(newEntry);
		}

		// Trim to max games
		if (this.history.length > MAX_GAMES) {
			this.history = this.history.slice(0, MAX_GAMES);
		}

		await this.save();
		Logger.info(`Added game "${name}" to activity history`);
	}

	/**
	 * Add a server to a game's server history
	 */
	async addServerToGame(placeId: string, server: ServerInfo): Promise<void> {
		await this.ensureLoaded();

		const game = this.history.find((entry) => entry.placeId === placeId);
		if (!game) {
			Logger.warn(`Cannot add server: game ${placeId} not found in history`);
			return;
		}

		// Check if server with same IP already exists (deduplicate)
		const existingServerIndex = game.servers.findIndex((s) => s.serverIP === server.serverIP);

		if (existingServerIndex !== -1) {
			// Update existing server and move to front
			game.servers.splice(existingServerIndex, 1);
		}

		// Add server at front
		game.servers.unshift(server);

		// Trim to max servers per game
		if (game.servers.length > MAX_SERVERS_PER_GAME) {
			game.servers = game.servers.slice(0, MAX_SERVERS_PER_GAME);
		}

		await this.save();
		Logger.info(`Added server ${server.jobId} to game ${placeId}`);
	}

	/**
	 * Get all game history entries
	 */
	async getHistory(): Promise<GameHistoryEntry[]> {
		await this.ensureLoaded();
		return [...this.history];
	}

	/**
	 * Clear all history
	 */
	async clearHistory(): Promise<void> {
		this.history = [];
		this.loaded = true;
		await this.save();
		Logger.info('Activity history cleared');
	}

	/**
	 * Remove a specific game from history
	 */
	async removeGame(placeId: string): Promise<void> {
		await this.ensureLoaded();
		this.history = this.history.filter((entry) => entry.placeId !== placeId);
		await this.save();
	}
}

export const ActivityHistoryManager = new ActivityHistoryManagerClass();
