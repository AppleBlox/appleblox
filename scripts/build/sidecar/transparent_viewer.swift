import Cocoa
import WebKit

// Custom draggable view that allows window dragging
class DraggableView: NSView {
    weak var parentWindow: NSWindow?
    private var initialLocation: NSPoint = NSPoint.zero
    
    override func mouseDown(with event: NSEvent) {
        guard let parentWindow = parentWindow else { return }
        initialLocation = event.locationInWindow
    }
    
    override func mouseDragged(with event: NSEvent) {
        guard let parentWindow = parentWindow else { return }
        
        let currentLocation = event.locationInWindow
        let newOrigin = NSPoint(
            x: parentWindow.frame.origin.x + (currentLocation.x - initialLocation.x),
            y: parentWindow.frame.origin.y + (currentLocation.y - initialLocation.y)
        )
        
        parentWindow.setFrameOrigin(newOrigin)
    }
    
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        return true
    }
}

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
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
        
        // Get the main screen to properly center the window
        guard let screen = NSScreen.main else {
            print("Could not get main screen")
            return
        }
        
        // Calculate centered position
        let screenFrame = screen.visibleFrame
        let windowRect = NSRect(
            x: screenFrame.origin.x + (screenFrame.width - windowWidth) / 2,
            y: screenFrame.origin.y + (screenFrame.height - windowHeight) / 2,
            width: windowWidth,
            height: windowHeight
        )
        
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
        window.acceptsMouseMovedEvents = true
        
        // Add rounded corners
        window.contentView?.wantsLayer = true
        window.contentView?.layer?.cornerRadius = 12.0
        window.contentView?.layer?.masksToBounds = true
        
        // Create visual effect view for vibrancy with minimal padding
        let padding: CGFloat = 4
        let contentFrame = window.contentView!.bounds.insetBy(dx: padding, dy: padding)
        
        visualEffectView = NSVisualEffectView(frame: contentFrame)
        visualEffectView.autoresizingMask = [.width, .height]
        visualEffectView.material = .hudWindow
        visualEffectView.blendingMode = .behindWindow
        visualEffectView.state = .active
        visualEffectView.wantsLayer = true
        visualEffectView.layer?.cornerRadius = 10.0
        visualEffectView.layer?.masksToBounds = true
        
        // Create WebView
        let webConfiguration = WKWebViewConfiguration()
        webConfiguration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        webConfiguration.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        
        // Add message handler for content ready notification
        let contentController = webConfiguration.userContentController
        contentController.add(self, name: "contentReady")
        
        // Remove default margins from WebView
        let cssString = """
            body { margin: 0 !important; padding: 0 !important; }
            * { box-sizing: border-box; }
        """
        let cssScript = WKUserScript(source: cssString, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        contentController.addUserScript(cssScript)
        
        webView = WKWebView(frame: visualEffectView.bounds, configuration: webConfiguration)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")
        webView.navigationDelegate = self
        
        // Ensure WebView doesn't interfere with window dragging
        webView.allowsMagnification = false
        webView.allowsBackForwardNavigationGestures = false
        
        // Set up view hierarchy
        window.contentView?.addSubview(visualEffectView)
        visualEffectView.addSubview(webView)
        
        // Create a custom view to handle dragging
        let draggableView = DraggableView(frame: window.contentView!.bounds)
        draggableView.autoresizingMask = [.width, .height]
        draggableView.parentWindow = window
        window.contentView?.addSubview(draggableView)
        
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
        
        // Prevent app from terminating when window closes
        NSApp.setActivationPolicy(.accessory)
    }
    
    // MARK: - WKNavigationDelegate
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Wait for actual DOM elements to be visible before showing window
        let jsCode = """
        function waitForCompleteRendering() {
            return new Promise((resolve) => {
                let checksComplete = 0;
                const totalChecks = 3; // Number of different checks to pass
                
                function checkComplete() {
                    checksComplete++;
                    if (checksComplete >= totalChecks) {
                        // Add multiple frame delays to ensure painting is complete
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                requestAnimationFrame(() => {
                                    setTimeout(() => {
                                        resolve(true);
                                    }, 150); // Extra delay for complex rendering
                                });
                            });
                        });
                    }
                }
                
                // Check 1: Wait for all images to load
                function waitForImages() {
                    const images = document.querySelectorAll('img');
                    if (images.length === 0) {
                        checkComplete();
                        return;
                    }
                    
                    let loadedImages = 0;
                    const imageLoadTimeout = setTimeout(() => {
                        checkComplete(); // Proceed even if some images fail
                    }, 2000);
                    
                    images.forEach(img => {
                        if (img.complete) {
                            loadedImages++;
                        } else {
                            img.onload = img.onerror = () => {
                                loadedImages++;
                                if (loadedImages >= images.length) {
                                    clearTimeout(imageLoadTimeout);
                                    checkComplete();
                                }
                            };
                        }
                    });
                    
                    if (loadedImages >= images.length) {
                        clearTimeout(imageLoadTimeout);
                        checkComplete();
                    }
                }
                
                // Check 2: Wait for fonts to load
                function waitForFonts() {
                    if (document.fonts && document.fonts.ready) {
                        document.fonts.ready.then(() => {
                            checkComplete();
                        }).catch(() => {
                            checkComplete(); // Proceed even if font loading fails
                        });
                    } else {
                        // Fallback for older browsers
                        setTimeout(checkComplete, 500);
                    }
                }
                
                // Check 3: Wait for visual content to be rendered
                function waitForVisualContent() {
                    let attempts = 0;
                    const maxAttempts = 20;
                    
                    function checkVisualContent() {
                        attempts++;
                        
                        // Check if body has meaningful dimensions
                        const body = document.body;
                        const html = document.documentElement;
                        
                        if (!body || !html) {
                            if (attempts < maxAttempts) {
                                setTimeout(checkVisualContent, 50);
                            } else {
                                checkComplete();
                            }
                            return;
                        }
                        
                        // Check for actual rendered content
                        const hasContent = body.offsetHeight > 50 && body.offsetWidth > 50;
                        const hasVisibleElements = Array.from(document.querySelectorAll('*')).some(el => {
                            const rect = el.getBoundingClientRect();
                            const styles = getComputedStyle(el);
                            return rect.width > 0 && 
                                   rect.height > 0 && 
                                   styles.visibility !== 'hidden' && 
                                   styles.display !== 'none' &&
                                   styles.opacity !== '0';
                        });
                        
                        // Check if CSS has been applied (look for computed styles)
                        const bodyStyles = getComputedStyle(body);
                        const hasStyles = bodyStyles.fontFamily !== '' || 
                                        bodyStyles.backgroundColor !== '' || 
                                        bodyStyles.color !== '';
                        
                        if (hasContent && hasVisibleElements && hasStyles) {
                            checkComplete();
                        } else if (attempts < maxAttempts) {
                            setTimeout(checkVisualContent, 50);
                        } else {
                            checkComplete(); // Proceed anyway after max attempts
                        }
                    }
                    
                    checkVisualContent();
                }
                
                // Start all checks
                if (document.readyState === 'complete') {
                    waitForImages();
                    waitForFonts();
                    waitForVisualContent();
                } else {
                    window.addEventListener('load', () => {
                        waitForImages();
                        waitForFonts();
                        waitForVisualContent();
                    });
                }
            });
        }
        
        waitForCompleteRendering().then(() => {
            window.webkit.messageHandlers.contentReady.postMessage('ready');
        });
        """
        
        webView.evaluateJavaScript(jsCode) { _, error in
            if let error = error {
                print("Error executing visibility check JavaScript: \(error)")
                // Fallback: show window after a delay if JS fails
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.window.makeKeyAndOrderFront(nil)
                }
            }
        }
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("Failed to load webpage: \(error.localizedDescription)")
        // Still show the window even if loading failed, but with a delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.window.makeKeyAndOrderFront(nil)
        }
    }
    
    // MARK: - WKScriptMessageHandler
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "contentReady" {
            DispatchQueue.main.async {
                self.window.makeKeyAndOrderFront(nil)
            }
        }
    }
    
    func loadDefaultHTML() {
        let defaultHTML = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: transparent;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: white;
                    text-align: center;
                    padding: 20px;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                h1 { color: white; text-shadow: 0 0 10px rgba(0,0,0,0.5); margin-bottom: 20px; }
                p { color: rgba(255,255,255,0.9); text-shadow: 0 0 5px rgba(0,0,0,0.5); margin-bottom: 10px; }
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
            <div class="corner-indicator">4px Padding ✓</div>
            <h1>Transparent Webpage Viewer</h1>
            <p>No webpage specified. Use --url argument to load a website.</p>
            <p>Usage: ./TransparentViewer --width 800 --height 600 --url https://example.com</p>
            <p>Window features: Minimal padding, rounded corners, transparent vibrancy</p>
        </body>
        </html>
        """
        webView.loadHTMLString(defaultHTML, baseURL: nil)
        // Let the JavaScript visibility check handle showing the window
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