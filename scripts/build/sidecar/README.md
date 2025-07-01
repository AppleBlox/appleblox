# Sidecar

Native macOS utilities for AppleBlox application operations. These scripts handle system-level tasks that require native code execution and are invoked from the Neutralino framework.

## Components

### Bootstrap (`bootstrap.m`)

Main launcher that bootstraps the AppleBlox application with proper configuration and deeplink handling.

**Features:**
- Launches the main executable with required arguments:
  ```
  --path=<app Resources folder>
  --enable-extensions=true
  --window-enable-inspector=true
  ```
- **Deeplink Support**: Handles URL scheme launches and manages app instances
- **Version Compatibility**: Detects macOS version and provides fallback options for unsupported versions (<11)
- **Permission Management**: Automatically requests accessibility permissions when needed
- **Instance Management**: Terminates duplicate instances when launching via deeplink
- **Logging**: Comprehensive logging to `latest.log` for debugging

**macOS Version Handling:**
- For macOS 11+: Normal app launch
- For macOS <11: Shows dialog with options to run in browser mode or continue anyway
- Automatic browser mode for deeplinks on unsupported versions

### URL Scheme Handler (`urlscheme.m`)

Command-line utility for managing default URL scheme handlers on macOS.

**Usage:**
```bash
# Set AppleBlox as default handler for a scheme
./urlscheme set roblox com.appleblox.AppleBlox

# Check current default handler
./urlscheme check roblox com.appleblox.AppleBlox
```

**Commands:**
- `set <SCHEME> <BUNDLE_ID>`: Sets the specified bundle as default handler
- `check <SCHEME> <BUNDLE_ID>`: Checks if the bundle is the current default handler

### Transparent Viewer (`transparent_viewer.swift`)

Advanced WebKit-based viewer for displaying web content in a transparent, floating window.

**Features:**
- **Transparent Design**: Vibrancy effects with minimal 4px padding and rounded corners
- **Smart Window Management**: Borderless, floating window that stays above other apps
- **Drag Support**: Custom draggable view for window repositioning
- **Content Detection**: Waits for complete DOM rendering before showing window
- **Quit Protection**: Disables standard quit shortcuts and prevents accidental closure

**Usage:**
```bash
./transparent_viewer --width 800 --height 600 --url https://example.com
```

**Parameters:**
- `--width`: Window width (default: 800)
- `--height`: Window height (default: 600)
- `--url`: Webpage URL to display (shows default page if omitted)

**Technical Details:**
- Uses `NSVisualEffectView` with `hudWindow` material for transparency
- Implements multi-stage content readiness detection (images, fonts, visual elements)
- Custom `DraggableView` class for window manipulation
- Prevents standard app termination behaviors



## Build Requirements

- macOS 11+ (recommended)
- Xcode command line tools
- Swift 5.0+ (for transparent_viewer)
- Objective-C runtime

## Development Notes

Most components were developed with AI assistance due to limited native macOS development expertise. The codebase prioritizes functionality and reliability over code elegance.

## Integration

These utilities integrate with the main AppleBlox Neutralino application through:
- Process spawning and IPC
- Named pipes for real-time communication
- File-based logging and state management
- System-level permission and URL scheme management