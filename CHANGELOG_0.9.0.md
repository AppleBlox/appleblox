# AppleBlox 0.9.0 – Release Notes

## What's New in 0.9.0

AppleBlox 0.9.0 is a massive update spanning 200+ commits. It brings multi-account management, a redesigned home page, game history tracking, Bloxstrap theme support, a new installer format, and hundreds of fixes and improvements across the entire app.

---

## New Features

### Multi-Account System
- Add and manage multiple Roblox accounts within AppleBlox
- Three ways to log in: auto-detect from the Roblox app, browser login, or manual cookie entry
- One-click account switching with automatic login handling
- Accounts are validated on startup — expired or invalid sessions are clearly indicated
- Credentials are stored securely in the macOS Keychain with a consent prompt before first access

### Quickplay Home Page
- The Home page has been redesigned to show your recently played games and full game history
- Launch games directly from the home page without going through Roblox
- Rejoin your last server instantly using the sidebar Rejoin button — useful after disconnects

### Game History Tracking
- Every game session is automatically logged with play time, duration, and server region
- Full history view with session details
- Tracking can be toggled on or off in Integrations settings

### Bloxstrap Bootstrapper Theme Support
- Import and use Bloxstrap XAML themes for the bootstrapper window
- Themes render with full element hierarchy, scaling, and color support

### Custom Icon Colors
- Change the colors of Roblox's in-game UI icons using a color picker
- Original icons are backed up automatically before changes are applied
- Works alongside other mods without conflicts

### Redesigned Mods Manager
- The mods interface now shows stacked preview images of files each mod changes
- Mod size and file count statistics are visible at a glance
- Improved download experience for remote mods

### Roblox Installation Manager
- Download Roblox directly from AppleBlox with real-time progress (speed + ETA)
- Automatic detection when Roblox is missing, with a prompt to install
- Background updates so you're not interrupted
- Custom installation path support
- CMD+R keyboard shortcut to open the install dialog from anywhere

### Enhanced Region Selection
- Region selection integrates with your active Roblox account
- Server lookup through RoValra's datacenter database
- Optional notifications showing which region you connected to

### Render Resolution Setting
- New option to control Roblox's render resolution independently from display resolution

### FastFlags Allowlist
- Roblox now enforces a flag allowlist — AppleBlox validates flags against it
- Flags not in the allowlist are clearly marked as blocked and will have no effect
- Invalid presets and deprecated flags have been removed

### Structured Debug Reports
- Debug bundle export now includes a machine-readable `summary.txt` with system info, active settings, and recent errors
- Copy debug report to clipboard directly from the Misc page
- Documentation button added to the Misc page for quick access to docs.appleblox.com

---

## Improvements

### Installation & Distribution
- Switched from DMG to PKG installer for a smoother installation experience
- Sidecar binaries are now built per-architecture (arm64/x64) for smaller downloads
- macOS Liquid Glass icon support (macOS 26+) with pre-compiled fallback

### User Interface
- New settings panel design with cleaner card layouts
- Sidebar now includes Home and Account navigation icons
- Improved onboarding flow with dynamic page generation
- Fixed alignment issues, pixel gaps, and hover transparency throughout the app
- Bulk enable/disable switch for FastFlags
- FPS target slider re-added for precise frame rate control
- "Engine" tab replaces the old "FastFlags" name

### Performance & Stability
- Logging system completely rewritten with structured log buffer, file-level context, and automatic credential redaction
- Fixed macOS incorrectly flagging AppleBlox as having crashed on quit
- Deeplink launching is faster
- Transparent viewer no longer hangs when closing the app
- WebView browser login freeze on newer macOS versions fixed
- Keychain sidecar race condition fixed (stdin write before exit listener)
- NeutralinoJS upgraded to 6.2.0
- Discord-RPC-cli bumped to 1.0.2 with `--update` flag support

### Quality of Life
- CMD+R to open Roblox installer, CMD+P to export settings
- Full app reset option with two-step confirmation (deletes keychain, settings, mods, cache)
- Alternative notification system via AppleScript for users where standard notifications don't work
- Data directories are created automatically on startup and after reset

---

## Bug Fixes

- Fix macOS crash-on-quit false detection
- Fix double-launching when using deeplinks from the app
- Fix transparency viewer hanging after closing AppleBlox
- Fix FPS uncapping not working correctly
- Fix mods and custom fonts persisting after removal
- Fix Quality Distance toggle not applying
- Fix Roblox path detection across different macOS configurations
- Fix Discord RPC showing escaped characters in game names
- Fix notification spam from game events
- Fix WebView browser login freeze on newer macOS
- Fix launch error related to mesh files in mods
- Fix critical NeutralinoJS bug with hidden windows
- Fix critical bug in FastFlags profiles select
- Fix toggle state check for settings widgets
- Fix icon colors on macOS 11
- Fix voice chat issues
- Fix sidebar hover transparency

---

## Removals

- Lightning presets removed (Roblox removed the underlying FastFlags)
- Workshop mod browser temporarily removed
- `.mesh` file support in mods removed (caused launch errors)
- Deprecated `getMostRecentRoblox()` function removed
- `isUrlReachable` utility removed

---

## For Developers

### Testing
- 199 unit tests across 7 test files covering paths, shell utilities, logger, settings, FastFlags allowlist, and binary cookies parser
- Test data isolation via `APPLEBLOX_DATA_DIR` env var
- E2E tests with Playwright against Vite dev server

### Build System
- Parallel build support for multiple architectures
- Per-architecture sidecar compilation
- PKG creation pipeline replaces DMG
- GitHub Actions updated to macOS 14+ with workflow_dispatch trigger

### Internal
- Structured `LogEntry` type with buffer, `getRecentErrors()`, and formatted output
- `DebugReport` interface with `collectDebugReport()` and `formatDebugReportAsText()`
- Keychain consent gate (`hasKeychainConsent` / `grantKeychainConsent`)
- Async `getAllowFixedDelays()` replaces module-level initialization
- CURL utility for CORS-free requests
- Concurrency-safe settings with caching
- Binary cookies parser for Roblox cookie extraction

---

For issues: [https://github.com/AppleBlox/AppleBlox/issues](https://github.com/AppleBlox/AppleBlox/issues)
Documentation: [https://docs.appleblox.com](https://docs.appleblox.com)
