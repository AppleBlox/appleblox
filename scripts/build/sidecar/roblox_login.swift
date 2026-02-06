import Cocoa
import WebKit
import Security

// MARK: - Keychain Helper

let keychainService = "ch.origaming.appleblox"
let keychainAccount = "roblox-cookie"

func secureZeroMemory(_ data: inout Data) {
    data.withUnsafeMutableBytes { ptr in
        if let baseAddress = ptr.baseAddress {
            memset_s(baseAddress, ptr.count, 0, ptr.count)
        }
    }
}

func storeInKeychain(_ cookie: String) -> Bool {
    var cookieData = cookie.data(using: .utf8)!

    // Delete any existing item first
    let deleteQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: keychainService,
        kSecAttrAccount as String: keychainAccount,
    ]
    SecItemDelete(deleteQuery as CFDictionary)

    // Add the new item
    let addQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: keychainService,
        kSecAttrAccount as String: keychainAccount,
        kSecValueData as String: cookieData,
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        kSecAttrSynchronizable as String: false,
    ]

    let status = SecItemAdd(addQuery as CFDictionary, nil)

    // Security: Zero out the cookie data from memory
    secureZeroMemory(&cookieData)

    return status == errSecSuccess
}

// MARK: - Process Monitor (reused from transparent_viewer.swift)

class ProcessMonitor {
    private var parentPID: pid_t
    private var timer: Timer?

    init(parentPID: pid_t) {
        self.parentPID = parentPID
    }

    func startMonitoring() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            self.checkProcesses()
        }
    }

    func stopMonitoring() {
        timer?.invalidate()
        timer = nil
    }

    private func checkProcesses() {
        if kill(parentPID, 0) != 0 {
            exitWithStatus("LOGIN_CANCELLED")
            return
        }

        if !isTargetProcessRunning() {
            exitWithStatus("LOGIN_CANCELLED")
        }
    }

    private func isTargetProcessRunning() -> Bool {
        let task = Process()
        let pipe = Pipe()

        task.launchPath = "/bin/ps"
        task.arguments = ["-axo", "comm"]
        task.standardOutput = pipe

        do {
            try task.run()
            task.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            if let output = String(data: data, encoding: .utf8) {
                let processes = output.components(separatedBy: .newlines)
                return processes.contains { process in
                    let processName = process.lowercased()
                    return processName.contains("appleblox") || processName.contains("ablox") || processName.contains("neutralino")
                }
            }
        } catch {
            // Ignore errors - assume still running
        }

        return false
    }
}

// MARK: - Exit Helper

func exitWithStatus(_ status: String) {
    print(status)
    fflush(stdout)
    NSApp.terminate(nil)
}

// MARK: - Navigation Policy

let allowedRobloxDomains = [
    "roblox.com",
    "www.roblox.com",
    "auth.roblox.com",
    "web.roblox.com",
    "login.roblox.com",
    "apis.roblox.com",
    "accountsettings.roblox.com",
]

let captchaDomains = [
    "hcaptcha.com",
    "recaptcha.net",
    "google.com",
    "gstatic.com",
    "googleapis.com",
    "arkose.com",
    "arkoselabs.com",
    "funcaptcha.com",
]

func isAllowedRobloxDomain(_ url: URL) -> Bool {
    guard let host = url.host?.lowercased() else { return false }
    return allowedRobloxDomains.contains(where: { host == $0 || host.hasSuffix(".\($0)") })
}

func isCaptchaDomain(_ url: URL) -> Bool {
    guard let host = url.host?.lowercased() else { return false }
    return captchaDomains.contains(where: { host == $0 || host.hasSuffix(".\($0)") })
}

// MARK: - App Delegate

class LoginAppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var processMonitor: ProcessMonitor?
    var cookieTimer: Timer?
    var timeoutTimer: Timer?
    var hasCompleted = false

    func applicationDidFinishLaunching(_ aNotification: Notification) {
        // Set up process monitoring
        let parentPID = getppid()
        processMonitor = ProcessMonitor(parentPID: parentPID)
        processMonitor?.startMonitoring()

        // Get the main screen to properly center the window
        guard let screen = NSScreen.main else {
            exitWithStatus("LOGIN_ERROR")
            return
        }

        let windowWidth: CGFloat = 480
        let windowHeight: CGFloat = 720

        // Calculate centered position
        let screenFrame = screen.visibleFrame
        let windowRect = NSRect(
            x: screenFrame.origin.x + (screenFrame.width - windowWidth) / 2,
            y: screenFrame.origin.y + (screenFrame.height - windowHeight) / 2,
            width: windowWidth,
            height: windowHeight
        )

        // Standard titled window - user must see this is a real Roblox page
        window = NSWindow(
            contentRect: windowRect,
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )

        window.title = "Sign in to Roblox - AppleBlox"
        window.level = .floating
        window.delegate = self

        // Use non-persistent data store - no cookies persist after exit
        let dataStore = WKWebsiteDataStore.nonPersistent()
        let webConfiguration = WKWebViewConfiguration()
        webConfiguration.websiteDataStore = dataStore

        webView = WKWebView(frame: window.contentView!.bounds, configuration: webConfiguration)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"

        window.contentView?.addSubview(webView)

        // Load the Roblox login page
        if let url = URL(string: "https://www.roblox.com/login") {
            webView.load(URLRequest(url: url))
        } else {
            exitWithStatus("LOGIN_ERROR")
            return
        }

        // Show the window
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        // Start polling for the .ROBLOSECURITY cookie every second
        cookieTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.checkForCookie()
        }

        // 5-minute timeout
        timeoutTimer = Timer.scheduledTimer(withTimeInterval: 300.0, repeats: false) { [weak self] _ in
            guard let self = self, !self.hasCompleted else { return }
            self.cleanup()
            exitWithStatus("LOGIN_TIMEOUT")
        }

        // Appear in dock while login is active
        NSApp.setActivationPolicy(.regular)
    }

    // MARK: - Cookie Polling

    private func checkForCookie() {
        guard !hasCompleted else { return }

        webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { [weak self] cookies in
            guard let self = self, !self.hasCompleted else { return }

            for cookie in cookies {
                if cookie.name == ".ROBLOSECURITY"
                    && cookie.domain.hasSuffix(".roblox.com")
                    && cookie.value.count > 100 {

                    self.hasCompleted = true

                    // Store directly in Keychain - cookie never touches stdout/args/logs
                    var cookieValue = cookie.value
                    let success = storeInKeychain(cookieValue)

                    // Security: Zero out the local copy
                    cookieValue = String(repeating: "\0", count: cookieValue.count)

                    self.cleanup()

                    if success {
                        exitWithStatus("LOGIN_SUCCESS")
                    } else {
                        exitWithStatus("LOGIN_ERROR")
                    }
                    return
                }
            }
        }
    }

    // MARK: - WKNavigationDelegate

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        // Allow about:blank and data: URLs
        if url.scheme == "about" || url.scheme == "data" {
            decisionHandler(.allow)
            return
        }

        // Main frame navigation: only allow roblox.com domains
        if navigationAction.targetFrame?.isMainFrame == true {
            if isAllowedRobloxDomain(url) {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
            }
            return
        }

        // Sub-resources (iframes, scripts, images): allow roblox.com + CAPTCHA providers
        if isAllowedRobloxDomain(url) || isCaptchaDomain(url) {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
        }
    }

    // MARK: - Cleanup

    func cleanup() {
        cookieTimer?.invalidate()
        cookieTimer = nil
        timeoutTimer?.invalidate()
        timeoutTimer = nil
        processMonitor?.stopMonitoring()

        // Clear all WebView data
        let dataStore = webView.configuration.websiteDataStore
        let allTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        dataStore.fetchDataRecords(ofTypes: allTypes) { records in
            dataStore.removeData(ofTypes: allTypes, for: records) { }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if !hasCompleted {
            cleanup()
            print("LOGIN_CANCELLED")
            fflush(stdout)
        }
        return .terminateNow
    }
}

// MARK: - Window Delegate

extension LoginAppDelegate: NSWindowDelegate {
    func windowWillClose(_ notification: Notification) {
        if !hasCompleted {
            hasCompleted = true
            cleanup()
            exitWithStatus("LOGIN_CANCELLED")
        }
    }
}

// MARK: - Custom Application (blocks Cmd+Q)

class LoginApplication: NSApplication {
    override func sendEvent(_ event: NSEvent) {
        if event.type == .keyDown {
            if event.modifierFlags.contains(.command) {
                if event.charactersIgnoringModifiers == "q" {
                    // Close window instead of quitting (triggers windowWillClose -> LOGIN_CANCELLED)
                    if let window = keyWindow {
                        window.close()
                    }
                    return
                }
                if event.charactersIgnoringModifiers == "w" {
                    if let window = keyWindow {
                        window.close()
                    }
                    return
                }
            }
        }
        super.sendEvent(event)
    }
}

// MARK: - Entry Point

func main() {
    let app = LoginApplication.shared
    let delegate = LoginAppDelegate()
    app.delegate = delegate
    app.run()
}

main()
