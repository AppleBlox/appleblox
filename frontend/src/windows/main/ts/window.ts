// Set up keyboard shortcuts and add extra commands to neutralino
import { events } from '@neutralinojs/lib';

import hotkeys from 'hotkeys-js';
import { shell } from './tools/shell';

// Shortcuts like copy, paste, quit, etc... (they are unimplemented by default in NeuJS)
hotkeys.filter = () => true;
hotkeys('ctrl+a,cmd+a', () => {
	document.execCommand('selectAll');
	return false;
});

hotkeys('ctrl+c,cmd+c', () => {
	document.execCommand('copy');
	return false;
});

hotkeys('ctrl+v,cmd+v', () => {
	document.execCommand('paste');
	return false;
});

hotkeys('ctrl+x,cmd+x', () => {
	document.execCommand('copy');
	document.execCommand('cut');
	return false;
});

hotkeys('ctrl+z,cmd+z', () => {
	document.execCommand('undo');
	return false;
});

hotkeys('ctrl+shift+z,cmd+shift+z', () => {
	document.execCommand('redo');
	return false;
});

hotkeys('cmd+q,cmd+w', () => {
	events.broadcast('exitApp');
	return false;
});

export async function focusWindow() {
	try {
		shell(
			`osascript -e 'tell application "System Events" to set frontmost of every process whose unix id is ${window.NL_PID} to true'`,
			[],
			{ skipStderrCheck: true, completeCommand: true }
		);
	} catch (err) {
		console.error(err);
	}
}

export async function setWindowVisibility(state: boolean) {
	try {
		shell(
			`osascript -e 'tell application "System Events" to set visible of every process whose unix id is ${window.NL_PID} to ${state}'`,
			[],
			{ skipStderrCheck: true, completeCommand: true }
		);
	} catch (err) {
		console.error(err);
	}
}
