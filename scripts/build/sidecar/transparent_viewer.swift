import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var visualEffectView: NSVisualEffectView!
    
    func applicationDidFinishLaunching(_ aNotification: Notification) {
        // Parse command line arguments for window size
        let args = CommandLine.arguments
        var windowWidth: CGFloat = 800
        var windowHeight: CGFloat = 600
        var webpageURL: String = ""
        
        // Parse arguments: --width 800 --height 600 --url https://example.com
        for i in 0..<args.count {
            if args[i] == "--width" && i + 1 < args.count {
                windowWidth = CGFloat(Double(args[i + 1]) ?? 800)
            } else if args[i] == "--height" && i + 1 < args.count {
                windowHeight = CGFloat(Double(args[i + 1]) ?? 600)
            } else if args[i] == "--url" && i + 1 < args.count {
                webpageURL = args[i + 1]
            }
        }
        
        // Create the window with specific styling
        let windowRect = NSRect(x: 0, y: 0, width: windowWidth, height: windowHeight)
        
        window = NSWindow(
            contentRect: windowRect,
            styleMask: [.borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        
        // Configure window properties
        window.backgroundColor = NSColor.clear
        window.isOpaque = false
        window.hasShadow = true
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.titlebarAppearsTransparent = true
        window.isMovableByWindowBackground = true
        
        // Add rounded corners
        window.contentView?.wantsLayer = true
        window.contentView?.layer?.cornerRadius = 12.0
        window.contentView?.layer?.masksToBounds = true
        
        // Center the window
        window.center()
        
        // Create visual effect view for vibrancy
        visualEffectView = NSVisualEffectView(frame: window.contentView!.bounds)
        visualEffectView.autoresizingMask = [.width, .height]
        visualEffectView.material = .hudWindow
        visualEffectView.blendingMode = .behindWindow
        visualEffectView.state = .active
        
        // Create WebView
        let webConfiguration = WKWebViewConfiguration()
        webConfiguration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        webConfiguration.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        
        webView = WKWebView(frame: window.contentView!.bounds, configuration: webConfiguration)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")
        
        // Ensure WebView doesn't interfere with window dragging
        webView.allowsMagnification = false
        
        // Set up view hierarchy
        window.contentView?.addSubview(visualEffectView)
        visualEffectView.addSubview(webView)
        
        // Load the webpage
        if !webpageURL.isEmpty {
            if let url = URL(string: webpageURL) {
                let request = URLRequest(url: url)
                webView.load(request)
            } else {
                print("Invalid URL: \(webpageURL)")
                loadDefaultHTML()
            }
        } else {
            loadDefaultHTML()
        }
        
        // Disable standard quit shortcuts
        if let menu = NSApp.mainMenu {
            disableQuitShortcuts(in: menu)
        }
        
        // Show the window
        window.makeKeyAndOrderFront(nil)
        
        // Prevent app from terminating when window closes
        NSApp.setActivationPolicy(.regular)
    }
    
    func loadDefaultHTML() {
        let defaultHTML = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    background: transparent;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: white;
                    text-align: center;
                    padding: 50px;
                    margin: 0;
                }
                h1 { color: white; text-shadow: 0 0 10px rgba(0,0,0,0.5); }
                p { color: rgba(255,255,255,0.9); text-shadow: 0 0 5px rgba(0,0,0,0.5); }
                .corner-indicator {
                    position: fixed;
                    top: 10px;
                    left: 10px;
                    background: rgba(255,255,255,0.2);
                    padding: 5px 10px;
                    border-radius: 8px;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="corner-indicator">Rounded Corners ✓</div>
            <h1>Transparent Webpage Viewer</h1>
            <p>No webpage specified. Use --url argument to load a website.</p>
            <p>Usage: ./TransparentViewer --width 800 --height 600 --url https://example.com</p>
            <p>Window features: Rounded corners, transparent vibrancy, drag anywhere to move</p>
        </body>
        </html>
        """
        webView.loadHTMLString(defaultHTML, baseURL: nil)
    }
    
    func disableQuitShortcuts(in menu: NSMenu) {
        for item in menu.items {
            // Disable quit shortcuts
            if item.keyEquivalent == "q" && item.keyEquivalentModifierMask.contains(.command) {
                item.keyEquivalent = ""
                item.keyEquivalentModifierMask = []
            }
            
            // Recursively check submenus
            if let submenu = item.submenu {
                disableQuitShortcuts(in: submenu)
            }
        }
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
    
    // Override terminate to prevent standard quit behavior
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        return .terminateCancel
    }
}

// Custom application class to handle key events
class CustomApplication: NSApplication {
    override func sendEvent(_ event: NSEvent) {
        // Block Cmd+Q and other quit shortcuts
        if event.type == .keyDown {
            if event.modifierFlags.contains(.command) {
                if event.charactersIgnoringModifiers == "q" ||
                   event.charactersIgnoringModifiers == "w" {
                    return // Don't process quit shortcuts
                }
            }
        }
        super.sendEvent(event)
    }
}

// Main application entry point
func main() {
    let app = CustomApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.run()
}

main()