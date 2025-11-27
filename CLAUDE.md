# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AppleBlox is a macOS-exclusive Roblox launcher built with Svelte (frontend) and NeutralinoJS (backend). It provides enhanced features like Discord Rich Presence, FastFlags management, mods support, and multi-instance launching.

## Development Commands

### Setup
```bash
bun install
brew install create-dmg  # Required for DMG creation
```

### Development
```bash
bun run --bun dev              # Start development environment (Vite + Neutralino)
bun run vite:dev               # Start Vite dev server only
```

### Building
```bash
bun run build                  # Build all architectures in parallel
bun run build:sequential       # Build all architectures sequentially
bun run build:arm64            # Build for Apple Silicon only
bun run build:x64              # Build for Intel only
bun run build:universal        # Build universal binary
bun run build:clean            # Clean build artifacts
```

### Release (Build + DMG)
```bash
bun run release                # Build and create DMGs (parallel)
bun run release:sequential     # Build and create DMGs (sequential)
bun run release:arm64          # Build and create arm64 DMG
bun run release:x64            # Build and create x64 DMG
bun run release:universal      # Build and create universal DMG
```

### Testing
```bash
bun test                       # Run all unit tests (46 tests)
bun test:unit                  # Run unit tests only
bun test:watch                 # Run tests in watch mode
bun test:coverage              # Run tests with coverage report
bun test:ui                    # Run E2E tests with Playwright
```

**Test Data Isolation:**
- Tests use isolated data directories via `APPLEBLOX_DATA_DIR` env var or `--data-dir` CLI arg
- Unit tests mock Neutralino APIs (filesystem, os, etc.)
- E2E tests run against Vite dev server at 1150x720 (AppleBlox window size)
- Webkit browser (Safari engine) used for E2E tests

**Test Coverage:**
- Path utilities (getDataDir, getModsDir, etc.) - 13 tests
- Shell utilities (escapeShellArg, buildCommand) - 21 tests
- Logger utilities - 3 tests
- Settings system smoke tests - 9 tests

### Code Quality
```bash
bun run format                 # Format code with Prettier
```

## Architecture

### Frontend Structure (`frontend/src/`)

The application has two main windows:

1. **Bootstrapper** (`windows/bootstrapper/`) - Initial loading screen
2. **Main Window** (`windows/main/`) - Primary application interface

#### Main Window Components

- **Pages** (`windows/main/pages/`) - Settings panels (Appearance, Engine, Integrations, Mods, etc.)
- **Components** (`windows/main/components/`) - Reusable UI components
  - `settings/` - Settings management system with file-based persistence
  - `flag-editor/` - FastFlags editor interface
  - `theme-input/` - Theme customization
  - `ui/` - Shadcn-style UI components (buttons, dialogs, inputs, etc.)

#### Core Modules (`windows/main/ts/`)

- **Roblox Module** (`roblox/`) - Main integration with Roblox
  - `delegate.ts` - URL scheme delegation (intercepts roblox:// and roblox-player:// URLs)
  - `downloader.ts` - Handles Roblox installation and updates
  - `fflags.ts` - FastFlags management (ClientAppSettings.json)
  - `instance.ts` - Multi-instance support and process management
  - `launch.ts` - Roblox launching logic
  - `mods.ts` - Mod installation and management
  - `updates.ts` - Update checking and installation
  - `events/` - Game event handlers (GameJoiningEntry, GameDisconnected, etc.)

- **Tools** (`tools/`)
  - `shell.ts` - Safe shell command execution with argument escaping
  - `rpc.ts` - Discord Rich Presence controller
  - `notifications.ts` - macOS notification system
  - `shellfs.ts` - Filesystem operations through shell

- **Utils** (`utils/`)
  - `logger.ts` - Application logging system
  - `debug.ts` - Debug information collection

### Backend (Sidecar Binaries)

Located in `scripts/build/sidecar/`, these are native macOS utilities written in Objective-C and Swift:

1. **bootstrap.m** - Main launcher with deeplink support and macOS version detection
2. **urlscheme.m** - URL scheme handler management (set/check default handlers)
3. **transparent_viewer.swift** - Transparent WebKit viewer for overlay content
4. **roblox_updater.sh** / **roblox_updater_manager.sh** - Roblox update automation

These are compiled during the build process and bundled with the app.

### Build System (`scripts/build/ts/`)

- `index.ts` - Sequential build orchestration
- `parallel-build.ts` - Parallel build for multiple architectures
- `mac-bundle.ts` - macOS .app bundle creation
- `sidecar.ts` - Compiles native sidecar binaries
- `dmg.ts` - DMG creation with create-dmg
- `utils.ts` - Shared build utilities

Architecture filtering via `BUILD_ARCH` environment variable (arm64, x64, universal).

## Key Technical Details

### NeutralinoJS Integration

- Binary names: `neutralino-mac_arm64`, `neutralino-mac_x64`, `neutralino-mac_universal`
- Configuration: `neutralino.config.json`
- Enabled APIs: events, os, filesystem, window, clipboard, computer, app, storage
- Document root: `/frontend/dist`

### Data Path Configuration

AppleBlox data directory is configurable for testing purposes:
- Default: `~/Library/Application Support/AppleBlox/`
- Override via environment variable: `APPLEBLOX_DATA_DIR=/path/to/test/data`
- Override via CLI argument: `--data-dir=/path/to/test/data`
- Programmatic override in tests: `setTestDataDirectory('/path')`

Path utilities in `frontend/src/windows/main/ts/utils/paths.ts`:
- `getDataDir()` - Base data directory
- `getModsDir()` - Mods directory
- `getCacheDir()` - Cache directory
- `getModsCacheDir()` - Mods backup directory
- `getFontsCacheDir()` - Font cache directory
- `getConfigDir()` - Config directory

All data path access must go through these utilities (no hardcoded paths).

### Settings System

Settings are managed through `frontend/src/windows/main/components/settings/`:
- File-based JSON storage per panel
- `getValue()` / `setValue()` for accessing settings
- `loadSettings()` / `saveSettings()` for persistence
- Settings are organized by panel ID (e.g., 'roblox.behavior.delegate')

### Event System

Game events from Roblox are processed through `roblox/events/index.ts`:
- GameJoiningEntry - User joining game
- GameJoinedEntry - User successfully joined
- GameDisconnected / GameLeaving - User left game
- GameMessageEntry - In-game messages (Bloxstrap SDK)
- ReturnToLuaApp - Return to Roblox app

### Deeplink Handling

The bootstrap sidecar handles `roblox://` and `roblox-player://` URLs:
1. Checks if AppleBlox is the default handler (via urlscheme binary)
2. Terminates existing instances if launching from deeplink
3. Passes URL to main application via command-line arguments

### Mod System

Mods are file-based replacements that override Roblox's content files:
- Mod structure mirrors `Roblox.app/Contents/Resources/` hierarchy
- Example: `MyMod/assets/xbutton_32.png` replaces `Roblox.app/Contents/Resources/assets/xbutton_32.png`
- System creates backup of Resources folder before applying mods
- Mods can be downloaded from remote sources or installed locally
- Supports enable/disable via `.disabled` suffix and complete rollback to backup

## Development Notes

### Running Dev Environment

The `bun run dev` command:
1. Checks for Neutralino binaries (downloads if missing)
2. Builds sidecar binaries if needed
3. Starts Vite dev server (default port 5173)
4. Launches Neutralino app with inspector enabled
5. Hot-reloading via Vite

### Vite Configuration

- Multi-page build: `index.html` (main) and `bootstrapper.html`
- Path aliases: `@/` → `frontend/src/`, `$lib/` → `frontend/src/lib/`, `@root/` → project root
- Safari target: Safari 12-18 for macOS compatibility
- Inline sourcemaps enabled

### Code Style

Prettier configuration (`.prettierrc`):
- Tabs (width 4)
- Single quotes
- Semicolons required
- Print width: 130
- Svelte plugin enabled

## Common Development Workflows

### Adding a New Settings Panel

1. Create Svelte component in `frontend/src/windows/main/pages/`
2. Register panel in settings system
3. Define settings schema with types
4. Use `getValue()` / `setValue()` for persistence

### Modifying Roblox Launch Behavior

Key file: `frontend/src/windows/main/ts/roblox/launch.ts`
- Integrates with FFlags, mods, and instance management
- Coordinates with native bootstrap binary
- Handles deeplink parameters

### Adding Native Functionality

1. Create/modify Objective-C or Swift file in `scripts/build/sidecar/`
2. Add to `sidecarFiles` array in `scripts/build/ts/sidecar.ts`
3. Specify compilation arguments and output name
4. Binary will be compiled and suffixed with `_ablox`

### Working with FastFlags

FastFlags are stored in Roblox's ClientAppSettings.json file.

Use the `RobloxFFlags` class:
- Load/save flag presets
- Merge custom flags
- Apply game-specific overrides

## CI/CD

GitHub Actions workflow (`.github/workflows/build.yml`):
- Runs on: macOS 13
- Triggers: Push to main/dev, PRs to main/dev
- Process: Install deps → Build → Create DMGs for all architectures → Upload artifacts
- Command: `bun run release:sequential`

## Important Paths

- Roblox installation: `/Applications/Roblox.app`
- AppleBlox data: `~/Library/Application Support/AppleBlox/`
  - Mods: `~/Library/Application Support/AppleBlox/mods/`
  - Mod backups: `~/Library/Application Support/AppleBlox/cache/mods/Resources/`
  - Font cache: `~/Library/Application Support/AppleBlox/cache/fonts/`
- Build output: `dist/` (gitignored)
- Temporary build: `.tmpbuild/` (gitignored)
- Binaries: `bin/` (contains pre-compiled and built binaries)

## External Dependencies

Pre-compiled binaries (downloaded during build):
- `discord-rpc-cli` from [AppleBlox/Discord-RPC-cli](https://github.com/AppleBlox/Discord-RPC-cli)
- `alerter` from [vjeantet/alerter](https://github.com/vjeantet/alerter)
