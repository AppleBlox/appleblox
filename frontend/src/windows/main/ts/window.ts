import {events, app, debug, os} from '@neutralinojs/lib';
import {getMode} from './env';

import hotkeys from 'hotkeys-js';
events
	.on('windowClose', () => {
		app.exit(0).catch(console.error);
	})
	.catch(console.error)
	.then(() => {
		debug.log('Attached window closer').catch(console.error);
	});

// Shortcuts like copy, paste, quit, etc... (they are unimplemented by default in NeuJS)
hotkeys('ctrl+c,cmd+c', (e) => {
	e.preventDefault();
	document.execCommand('copy');
});

hotkeys('ctrl+v,cmd+v', (e) => {
	e.preventDefault();
	document.execCommand('paste');
});

hotkeys('ctrl+x,cmd+x', (e) => {
	e.preventDefault();
	document.execCommand('copy');
	document.execCommand('cut');
});

hotkeys('ctrl+z,cmd+z', (e) => {
	e.preventDefault();
	document.execCommand('undo');
});

hotkeys('cmd+q,cmd+w', (e) => {
	e.preventDefault();
	app.exit(0);
});

hotkeys('ctrl+a,cmd+a', (e) => {
	e.preventDefault();
	document.execCommand('selectAll');
});

export async function focusWindow() {
	try {
		if (getMode() === 'dev') {
			// So the app can be focused in dev environnement
			os.execCommand(
				`osascript -e 'tell application "System Events" to set frontmost of every process whose unix id is ${window.NL_PID} to true'`
			);
		} else {
			// Better way of focusing the app
			os.execCommand(`open -a "AutoEvent"`);
		}
	} catch (err) {
		console.error(err);
	}
}
