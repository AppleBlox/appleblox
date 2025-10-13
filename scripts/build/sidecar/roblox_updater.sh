#!/bin/bash

set -euo pipefail

CHANNEL="LIVE"
CLIENT_SETTINGS_URL="https://clientsettings.roblox.com/v2/client-version/MacPlayer/channel/${CHANNEL}"
DOWNLOAD_HOST="https://setup-aws.rbxcdn.com"
TEMP_DIR="/tmp/ablox_roblox_update_$$"
LOG_FILE="/tmp/ablox_roblox_updater.log"
BUNDLE_ID="ch.origaming.appleblox"
ROBLOX_PROCESS_NAME="RobloxPlayer"
MAX_WAIT_TIME=900

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        log "Cleaned up temporary directory"
    fi
}

trap cleanup EXIT

send_notification() {
    local title="$1"
    local message="$2"
    
    local app_path
    app_path=$(mdfind "kMDItemCFBundleIdentifier == '$BUNDLE_ID'" | head -1)
    
    if [ -n "$app_path" ] && [ -f "$app_path/Contents/Resources/lib/alerter_ablox" ]; then
        "$app_path/Contents/Resources/lib/alerter_ablox" -message "$message" -title "$title" -sender "$BUNDLE_ID" -sound "default" &>/dev/null || true
    fi
}

detect_architecture() {
    local arch
    arch=$(uname -m)
    
    if [ "$arch" = "arm64" ]; then
        echo "apple"
    else
        echo "intel"
    fi
}

get_blob_dir() {
    local arch="$1"
    if [ "$arch" = "intel" ]; then
        echo "/mac"
    else
        echo "/mac/arm64"
    fi
}

find_roblox() {
    local roblox_path
    roblox_path=$(find /Applications "$HOME/Applications" -maxdepth 1 -iname '*roblox*.app' -exec stat -f '%a %N' {} + 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)
    
    if [ -z "$roblox_path" ]; then
        log "Roblox is not installed"
        exit 0
    fi
    
    echo "$roblox_path"
}

get_local_version() {
    local roblox_path="$1"
    local plist_path="${roblox_path}/Contents/Info.plist"
    
    if [ ! -f "$plist_path" ]; then
        log_error "Info.plist not found at $plist_path"
        exit 1
    fi
    
    local version
    version=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$plist_path" 2>/dev/null)
    
    if [ -z "$version" ]; then
        log_error "Could not read CFBundleVersion from Info.plist"
        exit 1
    fi
    
    echo "$version"
}

fetch_latest_version() {
    local response
    response=$(curl -s -f -m 10 --retry 2 "$CLIENT_SETTINGS_URL" 2>/dev/null)
    
    if [ $? -ne 0 ] || [ -z "$response" ]; then
        log_error "Failed to fetch version info from Roblox API"
        exit 1
    fi
    
    local version
    version=$(echo "$response" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$version" ]; then
        log_error "Could not parse version from API response"
        exit 1
    fi
    
    echo "$version"
}

build_download_url() {
    local version="$1"
    local arch="$2"
    local blob_dir
    blob_dir=$(get_blob_dir "$arch")
    
    local response
    response=$(curl -s -f -m 10 --retry 2 "$CLIENT_SETTINGS_URL" 2>/dev/null)
    
    if [ $? -ne 0 ] || [ -z "$response" ]; then
        log_error "Failed to fetch clientVersionUpload from Roblox API"
        exit 1
    fi
    
    local client_version_upload
    client_version_upload=$(echo "$response" | grep -o '"clientVersionUpload":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$client_version_upload" ]; then
        log_error "Could not parse clientVersionUpload from API response"
        exit 1
    fi
    
    local normalized_version
    if [[ "$client_version_upload" == version-* ]]; then
        normalized_version="$client_version_upload"
    else
        normalized_version="version-$client_version_upload"
    fi
    
    echo "${DOWNLOAD_HOST}${blob_dir}/${normalized_version}-RobloxPlayer.zip"
}

download_file() {
    local url="$1"
    local output="$2"
    
    log "Downloading from: $url"
    
    if ! curl -f -L -o "$output" \
        --connect-timeout 30 \
        --max-time 3600 \
        --retry 3 \
        --retry-delay 2 \
        -# \
        "$url" 2>&1 | while IFS= read -r line; do
            if [[ "$line" =~ ^# ]]; then
                echo -n "." >> "$LOG_FILE"
            fi
        done; then
        log_error "Download failed"
        return 1
    fi
    
    echo "" >> "$LOG_FILE"
    log "Download completed"
    return 0
}

wait_for_roblox_close() {
    if ! pgrep -x "$ROBLOX_PROCESS_NAME" >/dev/null; then
        log "Roblox is not running"
        return 0
    fi
    
    log "Roblox is running, waiting for it to close (timeout: ${MAX_WAIT_TIME}s)"
    
    local elapsed=0
    while pgrep -x "$ROBLOX_PROCESS_NAME" >/dev/null; do
        if [ $elapsed -ge $MAX_WAIT_TIME ]; then
            log_error "Timeout waiting for Roblox to close"
            return 1
        fi
        
        sleep 5
        elapsed=$((elapsed + 5))
    done
    
    log "Roblox has been closed"
    return 0
}

install_update() {
    local zip_path="$1"
    local install_path="$2"
    
    log "Installing update..."
    
    local extract_dir="${TEMP_DIR}/extract"
    mkdir -p "$extract_dir"
    
    if ! unzip -q "$zip_path" -d "$extract_dir"; then
        log_error "Failed to extract zip file"
        return 1
    fi
    
    local app_path="${extract_dir}/RobloxPlayer.app"
    if [ ! -d "$app_path" ]; then
        log_error "RobloxPlayer.app not found in extracted files"
        return 1
    fi
    
    if ! wait_for_roblox_close; then
        log_error "Could not install update: Roblox did not close in time"
        return 1
    fi
    
    local install_dir
    if [ -w "/Applications" ]; then
        install_dir="/Applications"
    else
        install_dir="$HOME/Applications"
        mkdir -p "$install_dir"
    fi
    
    local dest_path="${install_dir}/Roblox.app"
    
    if [ -e "$dest_path" ]; then
        log "Removing old Roblox installation"
        rm -rf "$dest_path"
    fi
    
    if ! mv "$app_path" "$dest_path"; then
        log_error "Failed to move Roblox.app to $dest_path"
        return 1
    fi
    
    chmod -R u+rwX "$dest_path"
    
    log "Successfully installed Roblox to $dest_path"
    return 0
}

main() {
    log "Starting Roblox update check"
    
    local roblox_path
    roblox_path=$(find_roblox)
    
    if [ -z "$roblox_path" ]; then
        exit 0
    fi
    
    log "Found Roblox at: $roblox_path"
    
    local local_version
    local_version=$(get_local_version "$roblox_path")
    log "Local version: $local_version"
    
    local remote_version
    remote_version=$(fetch_latest_version)
    log "Remote version: $remote_version"
    
    if [ "$local_version" = "$remote_version" ]; then
        log "Roblox is up to date"
        exit 0
    fi
    
    log "Update available: $local_version -> $remote_version"
    
    local arch
    arch=$(detect_architecture)
    log "System architecture: $arch"
    
    local download_url
    download_url=$(build_download_url "$remote_version" "$arch")
    
    mkdir -p "$TEMP_DIR"
    
    local zip_path="${TEMP_DIR}/RobloxPlayer.zip"
    if ! download_file "$download_url" "$zip_path"; then
        log_error "Failed to download update"
        exit 1
    fi
    
    if [ ! -f "$zip_path" ] || [ ! -s "$zip_path" ]; then
        log_error "Downloaded file is missing or empty"
        exit 1
    fi
    
    local file_size
    file_size=$(stat -f%z "$zip_path")
    log "Downloaded file size: $file_size bytes"
    
    if install_update "$zip_path" "$roblox_path"; then
        log "Roblox update completed successfully"
        send_notification "Roblox Updated" "Roblox has been updated to version $remote_version"
    else
        log_error "Failed to install update"
        send_notification "Roblox Update Failed" "Could not install Roblox update"
        exit 1
    fi
}

main "$@"