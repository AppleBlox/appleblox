#!/bin/bash

set -euo pipefail

BUNDLE_ID="ch.origaming.appleblox"
SCRIPT_NAME="roblox_updater_ablox.sh"
PLIST_NAME="rbxupdater_ablox.plist"
INSTALL_DIR="$HOME/bin"
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
SCRIPT_INSTALL_PATH="$INSTALL_DIR/$SCRIPT_NAME"
PLIST_INSTALL_PATH="$LAUNCH_AGENT_DIR/ch.origaming.appleblox.roblox-updater.plist"
LOG_FILE="/tmp/roblox_updater.log"
STDOUT_LOG="/tmp/roblox_updater_stdout.log"
STDERR_LOG="/tmp/roblox_updater_stderr.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

if [[ "$(uname)" != "Darwin" ]]; then
    log_error "This script is only for macOS"
    exit 1
fi

find_appleblox_resources() {
    local app_path
    app_path=$(mdfind "kMDItemCFBundleIdentifier == '$BUNDLE_ID'" | head -1)

    if [ -z "$app_path" ]; then
        log_error "AppleBlox app not found"
        exit 1
    fi

    echo "$app_path/Contents/Resources/lib"
}

do_install() {
    log "Starting installation..."

    local resources_dir
    resources_dir=$(find_appleblox_resources)

    local script_source="$resources_dir/$SCRIPT_NAME"
    local plist_source="$resources_dir/$PLIST_NAME"

    if [[ ! -f "$script_source" ]]; then
        log_error "Missing $script_source"
        exit 1
    fi

    if [[ ! -f "$plist_source" ]]; then
        log_error "Missing $plist_source"
        exit 1
    fi

    log "Found required files"

    # USER-OWNED INSTALL DIR
    if [[ ! -d "$INSTALL_DIR" ]]; then
        log "Creating install directory at $INSTALL_DIR"
        mkdir -p "$INSTALL_DIR"
    fi

    log "Copying updater script"
    cp "$script_source" "$SCRIPT_INSTALL_PATH"
    chmod +x "$SCRIPT_INSTALL_PATH"

    # LAUNCH AGENT
    if [[ ! -d "$LAUNCH_AGENT_DIR" ]]; then
        log "Creating LaunchAgents directory..."
        mkdir -p "$LAUNCH_AGENT_DIR"
    fi

    if [[ -f "$PLIST_INSTALL_PATH" ]]; then
        log "Unloading existing Launch Agent..."
        launchctl bootout "gui/$(id -u)/$BUNDLE_ID.roblox-updater" 2>/dev/null || true
    fi

    log "Installing Launch Agent..."
    cp "$plist_source" "$PLIST_INSTALL_PATH"
    chmod 644 "$PLIST_INSTALL_PATH"

    log "Loading Launch Agent..."
    launchctl bootstrap "gui/$(id -u)" "$PLIST_INSTALL_PATH" || {
        log_error "Failed to load Launch Agent"
        exit 1
    }

    if [[ -x "$SCRIPT_INSTALL_PATH" ]] && [[ -f "$PLIST_INSTALL_PATH" ]] && launchctl print "gui/$(id -u)/$BUNDLE_ID.roblox-updater" &>/dev/null; then
        log "Installation completed successfully"
        log "Updater will run every 10 minutes"
        log "Logs: $LOG_FILE"
    else
        log_error "Installation verification failed"
        exit 1
    fi
}

do_uninstall() {
    log "Starting uninstallation..."

    if [[ -f "$PLIST_INSTALL_PATH" ]]; then
        log "Unloading Launch Agent..."
        launchctl bootout "gui/$(id -u)/$BUNDLE_ID.roblox-updater" 2>/dev/null || true

        log "Removing plist..."
        rm "$PLIST_INSTALL_PATH" || {
            log_error "Failed to remove plist"
            exit 1
        }
    else
        log "Launch Agent not found, skipping"
    fi

    if [[ -f "$SCRIPT_INSTALL_PATH" ]]; then
        log "Removing updater script..."
        rm "$SCRIPT_INSTALL_PATH" || {
            log_error "Failed to remove script"
            exit 1
        }
    else
        log "Updater script not found, skipping"
    fi

    log "Removing log files..."
    rm -f "$LOG_FILE" "$STDOUT_LOG" "$STDERR_LOG"

    if [[ ! -f "$SCRIPT_INSTALL_PATH" ]] && [[ ! -f "$PLIST_INSTALL_PATH" ]] && ! launchctl list | grep -q "ch.origaming.appleblox.roblox-updater"; then
        log "Uninstallation completed successfully"
    else
        log_error "Uninstallation verification failed"
        exit 1
    fi
}

main() {
    if [[ $# -ne 1 ]]; then
        log_error "Usage: $0 install|uninstall"
        exit 1
    fi

    case "$1" in
        install)
            do_install
            ;;
        uninstall)
            do_uninstall
            ;;
        *)
            log_error "Invalid argument: $1"
            log_error "Usage: $0 install|uninstall"
            exit 1
            ;;
    esac
}

main "$@"
