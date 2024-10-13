import { RPCController } from '../../tools/rpc';
import type { GameEventInfo } from '../instance';

async function gameDisconnected(data: GameEventInfo) {
	RPCController.preset('inRobloxApp');
	console.info(`[Activity] ${data.event === 'GameDisconnected' ? 'Disconnected from game' : 'Leaving game'}`);
}

export default gameDisconnected;