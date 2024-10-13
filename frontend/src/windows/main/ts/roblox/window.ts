import { computer } from '@neutralinojs/lib';
import { libraryPath } from '../libraries';
import { shell, spawn, type SpawnEventEmitter } from '../tools/shell';
import shellFS from '../tools/shellfs';
import { sleep } from '../utils';

const pipeName = '/tmp/window_relay_ablox';
let shouldRestartWindowManager = false;

export interface WindowData {
	startingX: number;
	startingY: number;
	startingW: number;
	startingH: number;
	x: number | string;
	y: number | string;
	w: number | string;
	h: number | string;
	screenScaleX: number | string;
	screenScaleY: number | string;
	scaleX: number | string;
	scaleY: number | string;
}

let cachedRes: { res: computer.Resolution; createdAt: number } | null = null;
let windowManager: SpawnEventEmitter | null = null;
// Cache window coordinates
let windowCache: WindowData = {
	startingX: 0,
	startingY: 0,
	startingW: 0,
	startingH: 0,
	x: 0,
	y: 0,
	w: 0,
	h: 0,
	screenScaleX: 1920,
	screenScaleY: 1800,
	scaleX: 1,
	scaleY: 1,
};

// Kill the window_manager if it hasn't been called for more than 30 seconds.
let lastCall: number = Date.now();
setInterval(async () => {
	if (!windowManager) return;
	if (Date.now() - lastCall >= 30_000) {
		await windowManager.kill(true);
	}
}, 5000);

/** Scale coordinates to desktop res */
function scaleCoordinate(co: number | string, axis: 'x' | 'y', screenSize: computer.Resolution) {
	const ratio = axis === 'x' ? windowCache.scaleX : windowCache.scaleY;
	return Math.min(Math.max(parseInt(co.toString()) * parseInt(ratio.toString()), 0), screenSize.width);
}

export class RobloxWindow {
	/**
	 * Move and resize the Roblox window
	 * @param windowData Window object: {x: 0, y: 0, w: 0, h: 0}
	 */
	public static async setWindow(windowData: Partial<WindowData>) {
		try {
			const start = performance.now();
			await this.spawnWindowManager();
			if (!windowManager) {
				console.error("[Roblox.Window] Couldn't set window. Window Manager was undefined.");
				return;
			}
			windowCache = { ...windowCache, ...windowData };
			const screenSize = await this.getDesktopSize();
			// Scale the coordinates and size.
			windowCache.scaleX = screenSize.width / parseInt(windowCache.scaleX.toString());
			windowCache.scaleY = screenSize.height / parseInt(windowCache.scaleY.toString());
			// Apply the scaling
			windowData.x = scaleCoordinate(windowCache.x, 'x', screenSize);
			windowData.y = scaleCoordinate(windowCache.y, 'y', screenSize);
			windowData.w = scaleCoordinate(windowCache.w, 'x', screenSize);
			windowData.h = scaleCoordinate(windowCache.x, 'y', screenSize);

			// Write move data to relay file
			const cmd = `echo '[{"appName":"Roblox","x":${windowCache.x},"y":${windowCache.y},"width":${windowCache.w},"height":${windowCache.h}}]' > ${pipeName}`;
			shell(cmd, [], { completeCommand: true }).then(() => {
				console.info(
					`[Roblox.Window] Moved Roblox window to "${windowData.x},${windowData.y}", size "${windowData.w},${windowData.h}" in ${performance.now() - start}`
				);
			});
		} catch (err) {
			console.error("[Roblox.Window] Couldn't modify window:", err);
		}
	}

	/** Set the starting position and size to the current window properties */
	public static async saveState() {
		const currentPos = await this.getPos();
		const currentSize = await this.getSize();
		windowCache.startingX = currentPos?.x || windowCache.startingX;
		windowCache.startingY = currentPos?.y || windowCache.startingY;
		windowCache.startingW = currentSize?.w || windowCache.startingW;
		windowCache.startingH = currentSize?.w || windowCache.startingH;
	}

	/**
	 * Checks if Roblox is in fullscreen
	 * @returns true or false depending on the fullscreen state of Roblox's window
	 */
	public static async isFullscreen(): Promise<boolean> {
		const getInfoCmd = await shell(
			`osascript -e 'tell application "System Events"
            tell application "Roblox" to activate
            try
                tell process "Roblox"
                    set isFullscreen to value of attribute "AXFullScreen" of front window
                end tell
                return isFullscreen
            on error
                return "true"
            end try
        end tell'
        `,
			[],
			{ completeCommand: true }
		);
		return getInfoCmd.stdOut.trim() === 'true';
	}

	/**
	 * Set the fullscreen mode for the Roblox window
	 * @param fullscreen If true, activates fullscreen mode; if false, deactivates it
	 */
	public static async setFullscreen(fullscreen: boolean): Promise<void> {
		if ((await RobloxWindow.isFullscreen()) === fullscreen) return;
		await shell(
			`osascript -e 'tell application "Roblox" to activate' -e 'delay 0.5' -e 'tell application "System Events" to key down 63' -e 'tell application "System Events" to key down 3' -e 'delay 0.5' -e 'tell application "System Events" to key up 3' -e 'tell application "System Events" to key up 63'`,
			[],
			{ skipStderrCheck: true, completeCommand: true }
		);
	}

	/** Maximizes the roblox window on the desktop */
	public static async maximize() {
		const screenSize = await this.getDesktopSize();
		console.log(screenSize);
		await this.setWindow({ x: 0, y: 0, w: screenSize.width, h: screenSize.height });
	}

	/** Remove fullscreen and maximize the window */
	public static async reset() {
		await this.setFullscreen(false);
		await sleep(500);

		windowCache.x = windowCache.startingX;
		windowCache.y = windowCache.startingY;
		windowCache.w = windowCache.startingW;
		windowCache.h = windowCache.startingH;

		windowCache.screenScaleX = 1920;
		windowCache.screenScaleY = 1080;

		await this.setWindow({
			x: windowCache.x,
			y: windowCache.y,
			w: windowCache.w,
			h: windowCache.h,
		});
	}

	// TODO: remove this
	/** Sets the desktop resolution */
	public static async setDesktopRes(
		/** Width of the desktop */
		width: number | string,
		/** Height of the desktop */
		height: number | string,
		/** Duration in ms */
		duration = 1000
	): Promise<void> {
		return; // todo: change to modifying Roblox's plist
	}

	/** Returns the position of the roblox window as X and Y or null */
	public static async getPos(): Promise<null | { x: number; y: number }> {
		const pos = await shell(
			`osascript -e 'tell application "System Events" to get position of window 1 of process "Roblox"'`,
			[],
			{ completeCommand: true }
		).catch(() => {
			return null;
		});
		const posArray = pos?.stdOut.trim().split(', ');
		if (!posArray) {
			throw new Error("Couldn't retrieve window coordinates as posArray was undefined.");
		}
		return { x: parseInt(posArray[0]), y: parseInt(posArray[1]) };
	}

	/** Returns the width of the roblox window as w and h or null */
	public static async getSize(): Promise<null | { w: number; h: number }> {
		const pos = await shell(
			`osascript -e 'tell application "System Events" to get size of window 1 of process "Roblox"'`,
			[],
			{ completeCommand: true }
		).catch(() => {
			return null;
		});
		const sizeArray = pos?.stdOut.trim().split(', ');
		if (!sizeArray) {
			throw new Error("Couldn't retrieve window coordinates as posArray was undefined.");
		}
		return { w: parseInt(sizeArray[0]), h: parseInt(sizeArray[1]) };
	}

	/** Spawns the window_manager if it doesn't exist */
	private static async spawnWindowManager() {
		if (windowManager) return;
		if (!(await shellFS.exists(pipeName))) {
			await shell('mkfifo', [pipeName]);
		}
		shouldRestartWindowManager = false;
		await shell('pkill', ['-f', 'window_manager_ablox'], { skipStderrCheck: true });
		windowManager = await spawn(`${libraryPath('window_manager')} <> ${pipeName} &`, [], {
			completeCommand: true,
		});

		shouldRestartWindowManager = true;
		windowManager.on('stdErr', (data) => {
			console.error('[Roblox.Window] Window manager produced stdErr:', data);
		});
		windowManager.on('exit', (code) => {
			console.warn(`[Roblox.Window] Window manager exited with code: ${code}`);
			if (shouldRestartWindowManager) {
				this.spawnWindowManager();
			}
		});
		console.info(`[Roblox.Window] Spawned Window manager with PID: ${windowManager.pid}`);
	}

	private static async getDesktopSize(): Promise<computer.Resolution> {
		// If cache exists && it is not older than 5 minutes
		if ((cachedRes && Date.now() - cachedRes.createdAt >= 5 * 60 * 1000) || !cachedRes) {
			cachedRes = { res: (await computer.getDisplays())[0].resolution, createdAt: Date.now() };
		}
		return cachedRes.res;
	}
}
