import Cocoa
import Foundation

struct WindowCommand: Codable {
    let appName: String
    let x: Int
    let y: Int
    let width: Int
    let height: Int
}

class WindowManager {
    func moveAndResizeWindow(command: WindowCommand) {
        guard let app = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == command.appName }) else {
            print("error: Application not found")
            return
        }

        let pid = app.processIdentifier
        let axApp = AXUIElementCreateApplication(pid)

        var windowList: CFTypeRef?
        AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &windowList)

        guard let windows = windowList as? [AXUIElement], let window = windows.first else {
            print("error: No windows found for the application")
            return
        }

        var position = CGPoint(x: CGFloat(command.x), y: CGFloat(command.y))
        var size = CGSize(width: CGFloat(command.width), height: CGFloat(command.height))

        AXUIElementSetAttributeValue(window, kAXPositionAttribute as CFString, AXValueCreate(.cgPoint, &position)!)
        AXUIElementSetAttributeValue(window, kAXSizeAttribute as CFString, AXValueCreate(.cgSize, &size)!)
    }
}

let windowManager = WindowManager()
let decoder = JSONDecoder()

while let input = readLine() {
    guard let jsonData = input.data(using: .utf8) else {
        print("error: Invalid input encoding")
        continue
    }

    do {
        let commands = try decoder.decode([WindowCommand].self, from: jsonData)
        for command in commands {
            windowManager.moveAndResizeWindow(command: command)
        }
        print("success: Commands executed successfully")
    } catch {
        print("error: Invalid JSON - \(error.localizedDescription)")
    }
    
    fflush(stdout)
}