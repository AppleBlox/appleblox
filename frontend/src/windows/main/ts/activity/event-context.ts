/**
 * Event context for sharing state between game events.
 * Used to pass placeId and jobId from gameJoiningEntry to gameJoinedEntry.
 */

interface EventContext {
	placeId: string;
	jobId: string;
}

let currentContext: EventContext | null = null;

/**
 * Set the current event context
 */
export function setEventContext(placeId: string, jobId: string): void {
	currentContext = { placeId, jobId };
}

/**
 * Get the current event context
 */
export function getEventContext(): EventContext | null {
	return currentContext;
}

/**
 * Clear the current event context
 */
export function clearEventContext(): void {
	currentContext = null;
}
