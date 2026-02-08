# AppleBlox 0.9.0 – Release Notes

## What's New in 0.9.0

AppleBlox 0.9.0 brings account management, visual customization, game tracking, and hundreds of fixes and improvements.

---

## 🎯 Major Features

### Multi-Account System

* You can now add and manage multiple Roblox accounts directly within AppleBlox.
* The app supports auto-detection from the Roblox app, Browser login, or manual cookie entry.
* Switching between accounts takes one click, and AppleBlox handles the login process automatically.
* The interface shows which accounts are active or expired and validates them on startup to ensure they're ready to use.

### Redesigned Home Page (Quickplay)

* The Home page has been redesigned to display your recently played games and complete game history in one place.
* You can launch games directly from the home page without needing to search through Roblox.

### Game History Tracking

* Every game you play is now automatically logged with detailed information including play time, session duration, and server region.
* You can toggle tracking on or off in settings for privacy control.
* The Rejoin button in the sidebar lets you reconnect to your last server instantly, which is useful if you get disconnected or want to continue where you left off.

### Icon Customization

* AppleBlox now supports custom app icons through `.icns` file uploads.
* Bundled icon packs are included for quick customization, and switching between them takes just one click.
* This lets you personalize AppleBlox's appearance on your Mac to match your style.

### Custom Icon Colors

* You can change the colors of Roblox's in-game UI icons using a color picker with hue, saturation, and value controls.
* The system automatically backs up original icons before applying changes, so you can experiment without risk.
* This works alongside other mods without conflicts.

### Redesigned Mods Manager

* The mods interface has been overhauled to show stacked preview images of the files each mod changes.
* You can see mod size and file count statistics at a glance, making it easier to understand what each mod does before installing.

### Roblox Installation Manager

* Roblox can now be downloaded directly from AppleBlox with real-time progress tracking showing speed and estimated time.
* The app automatically detects if Roblox is missing and prompts you to install it.
* Updates can run in the background so you're not interrupted, and you can configure custom installation paths if needed.

### Enhanced Region Selection

* Region selection now integrates with your active Roblox account for more reliable server control.
* Using RoValra's database, you can get better control over which servers you connect to through the app.
* You can enable optional notifications to see which region you connected to when joining games.

---

## ✨ Key Improvements

### User Interface

* The sidebar now includes dedicated Home and Account icons for easier navigation.
* Settings panels have been modernized with cleaner card designs and better organization.
* The onboarding flow has been improved to guide new users through setup more clearly.
* Alignment issues throughout the app have been fixed for a more polished appearance.

### Engine Settings

* The FastFlags section has been renamed to "Engine" to better describe what these settings control.
* A bulk enable/disable switch lets you toggle multiple flags at once.
* The FPS target slider has been re-added for precise frame rate control.
* Outdated presets that no longer work have been removed, and safety warnings have been added for settings that might cause issues.

### Performance & Stability

* Roblox updates now happen in the background without interrupting your workflow.
* Launching from roblox:// deeplinks is faster.
* The logging system has been rewritten to be more organized and useful.
* The issue where macOS incorrectly detected AppleBlox as crashing on quit has been fixed, and voice chat should now work for everyone.

### Quality of Life

* You can now press CMD+R to open the Roblox installer from anywhere in the app.
* If you need support, you can now export your settings configuration by pressing CMD+P.

---

## 🐛 Notable Bug Fixes

* The macOS crash-on-quit detection issue has been resolved.
* Double-launching when using deeplinks no longer occurs.
* The transparency viewer no longer hangs when closing the app.
* FPS uncapping now works correctly.
* Custom fonts and mods no longer persist after you remove them.
* The Quality Distance toggle now applies properly.
* Roblox path detection works across different macOS configurations.
* Discord RPC no longer shows escaped characters in game names and no longer gets rate-limited when changing too quickly.
* Button alignment and pixel gaps have been fixed.
* Icon colors display correctly on macOS 11.

---

## 🗑️ Removals

* Lightning Presets have been removed since Roblox has removed the fastflags for them.

---

# Word of Thanks

Yes, this update has taken a significant amount of time, and I'm sorry for that. I have been quite busy with IRL work, so I haven't been able to work on AppleBlox as much as I would have liked. ❤️
Thank you for your patience — I hope you enjoy this update (as I think it's AppleBlox's best one so far)!

For issues: [https://github.com/AppleBlox/AppleBlox/issues](https://github.com/AppleBlox/AppleBlox/issues)