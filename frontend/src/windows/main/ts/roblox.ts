import {pathExists} from './utils';
import {os} from '@neutralinojs/lib';

export async function hasRoblox(): Promise<boolean> {
	if (await pathExists('/Applications/Roblox.app/Contents/MacOS/RobloxPlayer')) {
		return true;
	} else {
		os.execCommand(`osascript <<'END'
    set theAlertText to "Roblox is not installed"
    set theAlertMessage to "To use AppleBlox, you first need to install Roblox. Would you like to open the download page?"
    display alert theAlertText message theAlertMessage as critical buttons {"Cancel", "Open link"} default button "Open link" cancel button "Cancel" giving up after 60
    set the button_pressed to the button returned of the result
    if the button_pressed is "Open link" then
        open location "https://roblox.com/download"
    end if
END`);
		return false;
	}
}
