// Set up keyboard shortcuts and add extra commands to neutralino
import { events, os } from '@neutralinojs/lib';
import { getMode } from './utils';

import hotkeys from 'hotkeys-js';
import { shell } from './tools/shell';
import shellFS from './tools/shellfs';

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
	events.broadcast('exitApp');
});

export async function focusWindow() {
	try {
		if (getMode() === 'dev') {
			// So the app can be focused in dev environnement
			shell(
				`osascript -e 'tell application "System Events" to set frontmost of every process whose unix id is ${window.NL_PID} to true'`
			,[],{skipStderrCheck: true, completeCommand: true});
		} else {
			// Better way of focusing the app
			shellFS.open("",{application: "AppleBlox"})
			// <os.ececCommand>(`open -a "AppleBlox"`);
		}
	} catch (err) {
		console.error(err);
	}
}

export async function setWindowVisibility(state: boolean) {
	try {
		shell(
			`osascript -e 'tell application "System Events" to set visible of every process whose unix id is ${window.NL_PID} to ${state}'`
		,[],{skipStderrCheck: true, completeCommand: true});
	} catch (err) {
		console.error(err);
	}
}
