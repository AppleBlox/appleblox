import { os } from "@neutralinojs/lib";
import { libraryPath } from "./lib.paths";

const APPLICATION_ID = "1257650541677383721";

interface createRPCOpts {
    /** Your desired details string */
	details?: string;
    /** Your desired state string */
	state?: string;
    /** The name or URL of your large image */
	large_image?: string;
    /** The text shown on your large image */
	large_image_text?: string;
    /** The name or URL of your small image */
	small_image?: string;
    /** The text shown on your small image */
	small_image_text?: string;
    /** The url of your first button */
	button_url_1?: string;
    /** The text shown on your first button */
	button_text_1?: string;
    /** The url of your second button */
	button_url_2?: string;
    /** The text shown on your second button */
	button_text_2?: string;
    /** Set the start time (Unix time) */
	start_time?: string;
    /** Set the end time (Unix time) */
	end_time?: string;
    /** Creates a party with a current size of _ and a max size of _ (Example: [1,10]) */
	party_size?: [number, number];
    /** Sets the ID of the party (Has to be used with party_size) */
	party_id?: string | number;
    /** Sets the ID of the match (Can't be used with buttons) */
	match_id?: string | number;
    /** Sets the join ID of the match (Has to be used with match_id) */
	join_id?: string | number;
    /** Sets the spectate ID of the match (Has to be used with match_id) */
	spectate_id?: string | number;
    /** Whether to enable time or not (will count from current time) */
	enable_time?: boolean;
    /** Whether to enable AFK RPC or not */
	afk?: boolean;
    /** How many minutes should pass after the AFK RPC is started [In Minutes] */
	afk_after?: number;
    /** How often to check wether the user is idle or not [In Seconds] */
	afk_update?: number;
    /** Exit after a given time */
	exit_after?: number;
}

/** Creates a DiscordRPC from the provided args */
export async function createRPC(opts: createRPCOpts) {
	await terminateRPC();
	const args = [];
	for (const [arg, value] of Object.entries(opts)) {
		if (value) {
			args.push(`--${arg} "${value}"`);
		}
	}
	const cmd = `${libraryPath("discordrpc")} -c ${APPLICATION_ID} ${args.join(" ")}`;
	const proc = await os.spawnProcess(cmd);
	console.log(`[RPC] Start with: ${cmd}`)
}

/** Kills the RPC Agent */
export async function terminateRPC() {
	for (const proc of (await os.execCommand(`pgrep -f "discordrpc_ablox"`)).stdOut.split("\n")) {
		await os.execCommand(`kill -9 ${proc}`)
	}
}

/** Returns true if the agent is active and false if not */
export async function getRPCAgentState() {
	return (await os.execCommand('pgrep -f "discordrpc_ablox"')).stdOut.split("\n").length > 1
}