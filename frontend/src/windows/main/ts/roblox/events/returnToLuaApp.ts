import { getValue } from '@/windows/main/components/settings';
import { events } from '@neutralinojs/lib';

// Debounce
let latestReturnEvent: null | number = null;

async function returnToLuaApp() {
	if (latestReturnEvent && (Date.now() - latestReturnEvent) / 1000 < 10) return;
	latestReturnEvent = Date.now();
	const isDesktopAppDisabled = (await getValue<boolean>('roblox.behavior.disable_desktop_app')) === true;
	if (isDesktopAppDisabled) {
		console.info('[Activity] Disabling desktop app by terminating.');
		await events.broadcast('instance:quit');
	}
}

export default returnToLuaApp;
