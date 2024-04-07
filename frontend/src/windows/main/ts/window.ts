import {events, app, debug, os, window as w} from '@neutralinojs/lib';
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

// const draggableRegions: WeakMap<HTMLElement, any> = new WeakMap();
// export function setDraggableRegion(domElementOrId: string | HTMLElement): Promise<void> {
//     return new Promise((resolve: any, reject: any) => {
// 		// @ts-expect-error
//         const draggableRegion: HTMLElement = domElementOrId instanceof Element ?
//                                                     domElementOrId : document.getElementById(domElementOrId);
//         let initialClientX: number = 0;
//         let initialClientY: number = 0;
//         let absDragMovementDistance: number = 0;
//         let isPointerCaptured = false;
//         let lastMoveTimestamp = performance.now();

//         if (!draggableRegion) {
//             return reject({
//                 code: 'NE_WD_DOMNOTF',
//                 message: 'Unable to find DOM element'
//             });
//         }

//         if (draggableRegions.has(draggableRegion)) {
//             return reject({
//                 code: 'NE_WD_ALRDREL',
//                 message: 'This DOM element is already an active draggable region'
//             });
//         }

//         draggableRegion.addEventListener('pointerdown', startPointerCapturing);
//         draggableRegion.addEventListener('pointerup', endPointerCapturing);

//         draggableRegions.set(draggableRegion, { pointerdown: startPointerCapturing, pointerup: endPointerCapturing });

//         async function onPointerMove(evt: PointerEvent) {

//             if (isPointerCaptured) {

//                 const currentMilliseconds = performance.now();
//                 const timeTillLastMove = currentMilliseconds - lastMoveTimestamp;
//                 // Limit move calls to 1 per every 5ms - TODO: introduce constant instead of magic number?
//                 if (timeTillLastMove < 5) {
//                     // Do not execute move more often than 1x every 5ms or performance will drop
//                     return;
//                 }

//                 // Store current time minus the offset
//                 lastMoveTimestamp = currentMilliseconds - (timeTillLastMove - 5);

//                 await w.move(
//                     evt.screenX - initialClientX,
//                     evt.screenY - initialClientY
//                 );

//                 return;
//             }

//             // Add absolute drag distance
//             absDragMovementDistance = Math.sqrt(evt.movementX * evt.movementX + evt.movementY * evt.movementY);
//             // Only start pointer capturing when the user dragged more than a certain amount of distance
//             // This ensures that the user can also click on the dragable area, e.g. if the area is menu / navbar
//             if (absDragMovementDistance >= 10) { // TODO: introduce constant instead of magic number?
//                 isPointerCaptured = true;
//                 draggableRegion.setPointerCapture(evt.pointerId);
//             }
//         }

//         function startPointerCapturing(evt: PointerEvent) {
//             if (evt.button !== 0) return;
//             initialClientX = evt.clientX;
//             initialClientY = evt.clientY;
//             draggableRegion.addEventListener('pointermove', onPointerMove);
//         }

//         function endPointerCapturing(evt: PointerEvent) {
//             draggableRegion.removeEventListener('pointermove', onPointerMove);
//             draggableRegion.releasePointerCapture(evt.pointerId);
// 			isPointerCaptured = false
//         }

//         resolve({
//             success: true,
//             message: 'Draggable region was activated'
//         });
//     });
// };