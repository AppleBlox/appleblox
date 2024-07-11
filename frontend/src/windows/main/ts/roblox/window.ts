import { os } from "@neutralinojs/lib";

export class RobloxWindow {
	public static async isFullscreen() {
		return !(await os.execCommand(`osascript -e 'tell application "System Events" to tell process "Roblox" to get value of attribute "AXFullScreen" of window 1'`)).stdOut.includes("false");
	}

	public static async toggleFullscreen(state: boolean) {
		if (state) {
			if (await this.isFullscreen()) return;
			await os.execCommand(
				`osascript -e 'tell application "Roblox" to activate' -e 'delay 0.5' -e 'tell application "System Events" to tell process "Roblox" to if (value of attribute "AXFullScreen" of window 1) is false then keystroke "f" using {command down}'`
			);
		} else {
			if (await !this.isFullscreen()) return;
			await os.execCommand(
				`osascript -e 'tell application "Roblox" to activate' -e 'delay 0.5' -e 'tell application "System Events" to tell process "Roblox" to keystroke "f" using {command down}'`
			);
		}
	}

	public static async moveTo(x: number | string, y: number | string) {
		os.execCommand(`osascript -e 'on run {endX, endY}
    set steps to 2
    set delayTime to 0.001
    tell application "System Events" to tell process "Roblox"
        set {startX, startY} to position of front window
        set stepX to (endX - startX) / steps
        set stepY to (endY - startY) / steps
        repeat with i from 0 to steps
            set posX to startX + (i * stepX)
            set posY to startY + (i * stepY)
            set position of front window to {posX, posY}
            delay delayTime
        end repeat
        set position of front window to {endX, endY}
    end tell
end run' -- ${x} ${y}`);
		console.log(`Moved Roblox window to "${x},${y}"`);
	}

	public static async resize(width: number | string, height: number | string) {
		os.execCommand(`osascript -e 'on run {endWidth, endHeight}
    set steps to 2
    set delayTime to 0.001
    tell application "System Events" to tell process "Roblox"
        set {startWidth, startHeight} to size of front window
        set stepWidth to (endWidth - startWidth) / steps
        set stepHeight to (endHeight - startHeight) / steps
        repeat with i from 0 to steps
            set newWidth to startWidth + (i * stepWidth)
            set newHeight to startHeight + (i * stepHeight)
            set size of front window to {newWidth, newHeight}
            delay delayTime
        end repeat
        set size of front window to {endWidth, endHeight}
    end tell
end run' -- ${width} ${height}
`);
		console.log(`Resized Roblox window to "${width},${height}"`);
	}
}
