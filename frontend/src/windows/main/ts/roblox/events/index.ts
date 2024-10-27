import type { GameEventInfo } from '../instance';
import gameDisconnected from './gameDisconnected';
import gameJoinedEntry from './gameJoinedEntry';
import gameJoiningEntry from './gameJoiningEntry';
import gameMessageEntry from './gameMessageEntry';
import returnToLuaApp from './returnToLuaApp';

export default function onGameEvent(data: GameEventInfo) {
	switch (data.event) {
		case 'GameJoiningEntry':
			gameJoiningEntry(data);
			break;
		case 'GameDisconnected':
		case 'GameLeaving':
			gameDisconnected(data);
			break;
		case 'GameJoinedEntry':
			gameJoinedEntry(data);
			break;
		case 'GameMessageEntry':
			gameMessageEntry(data);
			break;
		case 'ReturnToLuaApp':
			returnToLuaApp();
			break;
	}
}
