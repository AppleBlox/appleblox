/**
 * Server information for activity history
 */
export interface ServerInfo {
	/** Server instance UUID (jobId) */
	jobId: string;
	/** Server IP address for deduplication */
	serverIP: string;
	/** Timestamp when the server was joined */
	joinedAt: number;
	/** Geographic region information */
	region: {
		city: string;
		region: string;
		country: string;
	};
}

/**
 * Game history entry for recently played games
 */
export interface GameHistoryEntry {
	/** Roblox place ID */
	placeId: string;
	/** Roblox universe ID */
	universeId: string;
	/** Game name */
	name: string;
	/** Creator/developer name */
	creator: string;
	/** Game icon URL */
	iconUrl: string;
	/** Timestamp when the game was last played */
	lastPlayed: number;
	/** List of recently joined servers (max 10) */
	servers: ServerInfo[];
}

/**
 * Options for adding a game entry
 */
export interface AddGameEntryOptions {
	placeId: string;
	universeId: string;
	name: string;
	creator: string;
	iconUrl: string;
	lastPlayed: number;
}
