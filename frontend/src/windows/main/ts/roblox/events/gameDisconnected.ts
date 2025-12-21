import { RPCController } from '../../tools/rpc';
import type { GameEventInfo } from '../instance';
import Logger from '@/windows/main/ts/utils/logger';

async function gameDisconnected(data: GameEventInfo) {
	RPCController.preset('inRobloxApp');
	Logger.info(`${data.event === 'GameDisconnected' ? 'Disconnected from game' : 'Leaving game'}`);
}

export default gameDisconnected;
