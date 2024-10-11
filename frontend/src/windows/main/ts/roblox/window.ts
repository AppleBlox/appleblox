import { computer } from '@neutralinojs/lib';
import { libraryPath } from '../libraries';
import { shell, spawn } from '../tools/shell';

const window_manager = libraryPath('window_manager');
let cachedRes: { res: computer.Resolution; createdAt: number } | null = null;

export class RobloxWindow {
	private readonly windowId: number = 1;

	/**
	 * Move the Roblox window smoothly
	 * @param x The target x-coordinate
	 * @param y The target y-coordinate
	 */
	public static async move(x: number | string, y: number | string) {
		await shell(`${window_manager}`, ['move', 'Roblox', x, y]);
		console.info(`[Roblox.Window] Moved Roblox window to "${x},${y}"`);
	}
	/**
	 * Resize the Roblox window smoothly
	 * @param width The target width
	 * @param height The target height
	 */
	public static async resize(width: number | string, height: number | string) {
		shell(`${window_manager}`, ['resize', 'Roblox', width, height]);
		console.info(`[Roblox.Window] Resized Roblox window to "${width},${height}"`);
	}

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
			`osascript -e 'tell application "Roblox" to activate' -e 'delay 0.5' -e 'tell application "System Events" to tell process "Roblox" to keystroke "f" using {command down}'`,
			[],
			{ skipStderrCheck: true, completeCommand: true }
		);
	}

	/** Maximizes the roblox window on the desktop */
	public static async maximize() {
		await RobloxWindow.move(0, 0);
		let screenSize;
		// If cache exists && it is not older than 5 minutes
		if (cachedRes && Date.now() - cachedRes.createdAt < 5 * 60 * 1000) {
		} else {
			cachedRes = {res: (await computer.getDisplays())[0].resolution, createdAt: Date.now()}
		}
		screenSize = cachedRes.res
		RobloxWindow.resize(screenSize.width, screenSize.height - 100);
	}

	/** Sets the desktop resolution */
	public static async setDesktopRes(
		/** Width of the desktop */
		width: number | string,
		/** Height of the desktop */
		height: number | string,
		/** Duration in ms */
		duration = 1000
	): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const wmanager = spawn(`${window_manager}`, ['setres', width, height, duration]);
			wmanager.on('stdErr', (data) => {
				if (data.includes('NO')) reject(`Impossible resolution (${width}, ${height})`);
			});
			wmanager.on('exit', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(`Window Manager exited with non-zero code (${code})`);
				}
			});
		});
	}
}
