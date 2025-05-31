import { getValue } from '@/windows/main/components/settings';
import { events } from '@neutralinojs/lib';
import { Notification } from '../../tools/notifications';

// Debounce
let latestReturnEvent: null | number = null;

async function returnToLuaApp() {
	if (latestReturnEvent && (Date.now() - latestReturnEvent) / 1000 < 10) return;
	latestReturnEvent = Date.now();
	const isDesktopAppDisabled = (await getValue<boolean>('roblox.behavior.disable_desktop_app')) === true;
	if (isDesktopAppDisabled) {
		new Notification({
			title: 'Closing desktop app',
			content: 'Disable desktop app setting is enabled.',
			timeout: 3000,
		}).show();
		console.info('[Activity] Disabling desktop app by terminating.');
		await events.broadcast('instance:quit');
	}
}

export default returnToLuaApp;
