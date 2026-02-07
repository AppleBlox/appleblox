# AppleBlox 0.9.0 - Release Notes

## What's New in 0.9.0

AppleBlox 0.9.0 brings account management, visual customization, game tracking, and hundreds of fixes and improvements.

---

## 🎯 Major Features

### Multi-Account System

Add and manage multiple Roblox accounts with auto-detection from the Roblox app, WebView login, or manual entry. Switch between accounts with one click. The interface shows which accounts are active or expired, and automatically validates them on startup.

### Redesigned Home Page (Quickplay)

The Home page displays your recently played games, pinned favorites, and complete game history. Game cards show icons, player counts, and descriptions. Launch games directly from the home page.

### Game History Tracking

Games are automatically logged with play time, session duration, and server region. Toggle tracking on or off in settings. The Rejoin button in the sidebar reconnects you to your last server.

### Icon Customization

Upload `.icns` files to change AppleBlox's icon. Bundled icon packs are included, and switching icons takes one click.

### Custom Icon Colors

Change Roblox's in-game UI icon colors using a color picker. Original icons are automatically backed up.

### Redesigned Mods Manager

Mods show stacked preview images of changed files. View mod size and file count statistics.

### Roblox Installation Manager

Download Roblox directly from AppleBlox with progress tracking. The app detects missing installations and prompts you to install. Updates run in the background. Custom installation paths are configurable.

### Enhanced Region Selection

Region selection integrates with your active account. API improvements provide more accurate region detection. Optional notifications show which region you connected to.

---

## ✨ Key Improvements

### User Interface

New Home and Account icons in the sidebar. Modernized settings panels with cleaner organization. Improved onboarding flow. Fixed alignment issues throughout the app.

### Engine Settings (FastFlags)

Renamed from "FastFlags" to "Engine". Bulk enable/disable switch for multiple flags. FPS target slider re-added. Outdated presets removed. Safety warnings added.

### Performance & Stability

Roblox updates in the background. Faster deeplink launching. New logging system. Fixed macOS crash-on-quit detection. Removed thread-blocking code. Voice chat fixes.

### Quality of Life

CMD+R opens Roblox installer. Rejoin button for last server. Full app reset option. Settings export. Better multi-instance warnings.

---

## 🐛 Notable Bug Fixes

Fixed macOS crash-on-quit detection. Resolved double-launching with deeplinks. Fixed transparency viewer hanging. FPS uncapping now works. Custom fonts and mods no longer persist after removal. Quality Distance toggle applies correctly. Fixed Roblox path detection. Discord RPC no longer shows escaped characters. Fixed button alignment and pixel gaps. Icon colors work on macOS 11.

---

## 🗑️ Removals

**Lightning Presets** removed by Roblox. **Invalid FastFlag presets** cleaned up. **Metal/Vulkan + FPS Unlock** combination prevented to avoid crashes.

---

*For issues: https://github.com/AppleBlox/AppleBlox/issues*
