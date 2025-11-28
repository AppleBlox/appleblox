#import <Cocoa/Cocoa.h>

@interface AppDelegate : NSObject <NSApplicationDelegate>
@property (nonatomic, strong) NSTask *mainTask;
@property (nonatomic, strong) NSPipe *outputPipe;
@property (nonatomic, strong) NSFileHandle *logFileHandle;
@property (nonatomic, strong) NSString *deeplinkArgument;
@property (nonatomic, assign) BOOL isRequestingPermission;
@property (nonatomic, assign) pid_t childPid;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
    [self setupLogging];
    [self logMessage:@"Application did finish launching"];
    
    // Check if we were launched with a URL first
    BOOL hasDeeplink = NO;
    NSArray *arguments = [[NSProcessInfo processInfo] arguments];
    for (NSString *arg in arguments) {
        if ([arg hasPrefix:@"--deeplink="]) {
            hasDeeplink = YES;
            self.deeplinkArgument = arg;
            [self logMessage:[NSString stringWithFormat:@"App launched with URL: %@", self.deeplinkArgument]];
            [self terminateOtherInstances];
            break;
        }
    }
    
    BOOL isSupported = [self isMacOSVersionSupported];
    
    if (!isSupported) {
        if (hasDeeplink) {
            // Automatically use browser mode for deeplinks on unsupported OS
            [self logMessage:@"Unsupported OS with deeplink - automatically using browser mode"];
            [self setupActivationPolicy:YES];
            [self continueStartup:YES];
        } else {
            // Show dialog for normal launches on unsupported OS
            [self showUnsupportedVersionDialog];
        }
    } else {
        // Normal startup for supported OS
        [self setupActivationPolicy:NO];
        [self continueStartup:NO];
    }
}

- (BOOL)useNativeBootstrapIcon {
    // Check if bootstrap_native file exists in Resources
    NSString *resourcesPath = [[NSBundle mainBundle] resourcePath];
    NSString *flagPath = [resourcesPath stringByAppendingPathComponent:@"bootstrap_native"];
    return [[NSFileManager defaultManager] fileExistsAtPath:flagPath];
}

- (void)setupActivationPolicy:(BOOL)browserMode {
    if ([self useNativeBootstrapIcon]) {
        // Show bootstrap dock icon, hide Neutralino icon
        [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
        [self logMessage:@"Using native bootstrap icon (Neutralino hidden)"];
    } else {
        // Hide bootstrap dock icon, show Neutralino icon
        [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
        [self logMessage:@"Using Neutralino icon (bootstrap hidden)"];
    }
}

- (void)centerWindow:(NSWindow *)window {
    NSRect screenFrame = [NSScreen mainScreen].frame;
    NSRect windowFrame = window.frame;
    
    CGFloat x = NSMidX(screenFrame) - (windowFrame.size.width / 2);
    CGFloat y = NSMidY(screenFrame) - (windowFrame.size.height / 2);
    
    [window setFrameOrigin:NSMakePoint(x, y)];
}

- (void)continueStartup:(BOOL)browserMode {
    [self launchMainExecutable:browserMode];
}

- (BOOL)isMacOSVersionSupported {
    NSOperatingSystemVersion version = [[NSProcessInfo processInfo] operatingSystemVersion];
    return version.majorVersion >= 11;
}

- (void)showUnsupportedVersionDialog {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = @"Unsupported MacOS Version";
    alert.informativeText = @"AppleBlox has been reported broken on older versions of MacOS (<11). If you encounter a white window, please do not report this issue. You can try running AppleBlox in your default browser as a temporary fix.";
    
    NSButton *browserButton = [alert addButtonWithTitle:@"Open in default browser"];
    NSButton *openButton = [alert addButtonWithTitle:@"Open Anyway"];
    
    // Make browser button the default button
    browserButton.highlighted = YES;
    [browserButton setKeyEquivalent:@"\r"];  // Return key
    [openButton setKeyEquivalent:@""];
    
    // Explicitly mark browser button as the default button with accent color
    [alert.window.contentView.window setDefaultButtonCell:browserButton.cell];
    
    // Center the alert window on screen before showing it
    [self centerWindow:alert.window];
    
    // Make sure alert window is frontmost and focused
    [NSApp activateIgnoringOtherApps:YES];
    [alert.window makeKeyAndOrderFront:nil];
    
    NSModalResponse response = [alert runModal];
    
    if (response == NSAlertFirstButtonReturn) {
        // Browser button clicked
        [self logMessage:@"User chose to open in browser mode"];
        [self setupActivationPolicy:YES];
        [self continueStartup:YES];
    } else {
        // Open Anyway button clicked
        [self logMessage:@"User chose to continue despite version warning"];
        [self setupActivationPolicy:NO];
        [self continueStartup:NO];
    }
}

- (void)terminateOtherInstances {
    NSString *bundleIdentifier = [[NSBundle mainBundle] bundleIdentifier];
    NSArray *runningApps = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier];
    
    for (NSRunningApplication *app in runningApps) {
        if (![app isEqual:[NSRunningApplication currentApplication]]) {
            [self logMessage:[NSString stringWithFormat:@"Terminating other instance with PID: %d", app.processIdentifier]];
            [app terminate];
        }
    }
}

- (void)launchMainExecutable:(BOOL)browserMode {
    NSString *mainPath = [[[NSBundle mainBundle] bundlePath] stringByAppendingPathComponent:@"Contents/MacOS/main"];
    NSString *resourcesPath = [[NSBundle mainBundle] resourcePath];
    
    [self logMessage:[NSString stringWithFormat:@"Main executable path: %@", mainPath]];
    [self logMessage:[NSString stringWithFormat:@"Resources path: %@", resourcesPath]];
    
    if (![[NSFileManager defaultManager] fileExistsAtPath:mainPath]) {
        [self logMessage:@"ERROR: Main executable not found at the specified path"];
        [NSApp terminate:nil];
        return;
    }
    
    self.mainTask = [[NSTask alloc] init];
    self.mainTask.launchPath = mainPath;
    
    NSMutableArray *taskArguments = [NSMutableArray arrayWithObjects:
                                     [NSString stringWithFormat:@"--path=%@", resourcesPath],
                                     @"--enable-extensions=true",
                                     @"--window-enable-inspector=true",
                                     nil];

    // Add skipTaskbar flag based on mode
    if ([self useNativeBootstrapIcon]) {
        // Hide Neutralino's dock icon
        [taskArguments addObject:@"--window-skip-taskbar=true"];
    } else {
        // Show Neutralino's dock icon
        [taskArguments addObject:@"--window-skip-taskbar=false"];
    }

    if (browserMode) {
        [taskArguments addObject:@"--mode=browser"];
    }

    if (self.deeplinkArgument) {
        [taskArguments addObject:self.deeplinkArgument];
    }
    
    self.mainTask.arguments = taskArguments;
    
    [self logMessage:[NSString stringWithFormat:@"Launching main executable with arguments: %@", taskArguments]];

    self.outputPipe = [NSPipe pipe];
    self.mainTask.standardOutput = self.outputPipe;
    self.mainTask.standardError = self.outputPipe;

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleTaskOutput:)
                                                 name:NSFileHandleReadCompletionNotification
                                               object:[self.outputPipe fileHandleForReading]];

    [[self.outputPipe fileHandleForReading] readInBackgroundAndNotify];

    @try {
        [self.mainTask launch];
        self.childPid = [self.mainTask processIdentifier];
        [self logMessage:[NSString stringWithFormat:@"Main executable launched successfully (PID: %d)", self.childPid]];
    } @catch (NSException *exception) {
        [self logMessage:[NSString stringWithFormat:@"ERROR: Failed to launch main executable: %@", exception.reason]];
        [NSApp terminate:nil];
        return;
    }

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(taskDidTerminate:)
                                                 name:NSTaskDidTerminateNotification
                                               object:self.mainTask];
}

- (void)handleTaskOutput:(NSNotification *)notification {
    NSData *data = notification.userInfo[NSFileHandleNotificationDataItem];
    if (data.length > 0) {
        NSString *output = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        [self logMessage:[NSString stringWithFormat:@"Main executable output: %@", output]];
        
        // Check if the output contains "askPerm"
        if ([output containsString:@"askPerm"] && !self.isRequestingPermission) {
            dispatch_async(dispatch_get_main_queue(), ^{
                [self requestAccessibilityPermission];
            });
        }
    }
    [[self.outputPipe fileHandleForReading] readInBackgroundAndNotify];
}

- (void)requestAccessibilityPermission {
    [self logMessage:@"Requesting accessibility permission"];
    self.isRequestingPermission = YES;
    
    dispatch_async(dispatch_get_main_queue(), ^{
        NSDictionary *options = @{(__bridge id)kAXTrustedCheckOptionPrompt: @YES};
        BOOL accessibilityEnabled = AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
        
        if (accessibilityEnabled) {
            [self logMessage:@"Accessibility permission granted"];
        } else {
            [self logMessage:@"Accessibility permission not granted"];
        }
        
        self.isRequestingPermission = NO;
    });
}

- (void)setupLogging {
    NSString *logPath = [[[NSBundle mainBundle] resourcePath] stringByAppendingPathComponent:@"latest.log"];
    [[NSFileManager defaultManager] createFileAtPath:logPath contents:nil attributes:nil];
    self.logFileHandle = [NSFileHandle fileHandleForWritingAtPath:logPath];
    [self.logFileHandle seekToEndOfFile];
}

- (void)logMessage:(NSString *)message {
    NSDateFormatter *dateFormatter = [[NSDateFormatter alloc] init];
    [dateFormatter setDateFormat:@"yyyy-MM-dd HH:mm:ss"];
    NSString *timestamp = [dateFormatter stringFromDate:[NSDate date]];
    
    NSString *logMessage = [NSString stringWithFormat:@"[%@] %@\n", timestamp, message];
    
    NSLog(@"%@", logMessage);
    
    [self.logFileHandle writeData:[logMessage dataUsingEncoding:NSUTF8StringEncoding]];
}

- (void)taskDidTerminate:(NSNotification *)notification {
    [self logMessage:@"Main executable terminated, quitting bootstrap"];
    [NSApp terminate:nil];
}

- (void)applicationDidBecomeActive:(NSNotification *)notification {
    // Only focus child window in native bootstrap icon mode
    if ([self useNativeBootstrapIcon]) {
        // When app becomes active (Command+Tab, dock click, etc.), focus child window
        [self logMessage:@"App became active, focusing child window"];
        [self focusChildWindow];
    }
}

- (BOOL)applicationShouldHandleReopen:(NSApplication *)sender hasVisibleWindows:(BOOL)flag {
    // Dock icon clicked - handled by applicationDidBecomeActive
    return YES;
}

- (void)focusChildWindow {
    if (self.childPid <= 0) {
        [self logMessage:@"No child process to focus"];
        return;
    }

    NSString *script = [NSString stringWithFormat:
        @"tell application \"System Events\"\n"
        @"    set procList to every process whose unix id is %d\n"
        @"    if (count of procList) > 0 then\n"
        @"        set frontmost of item 1 of procList to true\n"
        @"    end if\n"
        @"end tell", self.childPid];

    NSAppleScript *appleScript = [[NSAppleScript alloc] initWithSource:script];
    NSDictionary *errorDict = nil;
    [appleScript executeAndReturnError:&errorDict];

    if (errorDict) {
        [self logMessage:[NSString stringWithFormat:@"Error focusing child window: %@", errorDict]];
    } else {
        [self logMessage:@"Child window focused successfully"];
    }
}

- (void)applicationDidHide:(NSNotification *)notification {
    // Only manage window in native bootstrap icon mode
    if ([self useNativeBootstrapIcon]) {
        [self logMessage:@"Bootstrap hidden, sending hide command"];
        [self sendCommandToChild:@"hide"];
    }
}

- (void)applicationDidUnhide:(NSNotification *)notification {
    // Only manage window in native bootstrap icon mode
    if ([self useNativeBootstrapIcon]) {
        [self logMessage:@"Bootstrap unhidden, sending show command"];
        [self sendCommandToChild:@"show"];

        // Also focus the window using AppleScript
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [self focusChildWindow];
        });
    }
}

- (void)sendCommandToChild:(NSString *)command {
    @try {
        // Write command to temp file for IPC
        NSString *commandFile = @"/tmp/appleblox-bootstrap-command";
        NSString *commandWithNewline = [NSString stringWithFormat:@"%@\n", command];
        NSError *error = nil;
        BOOL success = [commandWithNewline writeToFile:commandFile
                                            atomically:YES
                                              encoding:NSUTF8StringEncoding
                                                 error:&error];
        if (success) {
            [self logMessage:[NSString stringWithFormat:@"Sent command to child: %@", command]];
        } else {
            [self logMessage:[NSString stringWithFormat:@"Error writing command file: %@", error.localizedDescription]];
        }
    } @catch (NSException *exception) {
        [self logMessage:[NSString stringWithFormat:@"Error sending command: %@", exception.reason]];
    }
}

- (void)applicationWillTerminate:(NSNotification *)aNotification {
    [self logMessage:@"Bootstrap is terminating, killing main executable"];
    [self.mainTask terminate];
    [self.logFileHandle closeFile];
}

- (void)application:(NSApplication *)application openURLs:(NSArray<NSURL *> *)urls {
    if (urls.count > 0) {
        NSURL *url = urls[0];
        NSString *urlString = [url absoluteString];
        [self logMessage:[NSString stringWithFormat:@"Received URL: %@", urlString]];
        
        // Terminate other instances before restarting
        [self terminateOtherInstances];
        
        // Restart the app with the new URL
        NSString *appPath = [[NSBundle mainBundle] bundlePath];
        NSTask *restartTask = [[NSTask alloc] init];
        restartTask.launchPath = @"/usr/bin/open";
        restartTask.arguments = @[appPath, @"-n", @"--args", [NSString stringWithFormat:@"--deeplink=%@", urlString]];
        
        [self logMessage:[NSString stringWithFormat:@"Restarting app with new URL: %@", urlString]];
        
        NSError *error = nil;
        [restartTask launchAndReturnError:&error];
        if (error) {
            [self logMessage:[NSString stringWithFormat:@"Error restarting app: %@", error.localizedDescription]];
        } else {
            // Terminate the current instance only if restart was successful
            [NSApp terminate:nil];
        }
    }
}

@end

int main() {
    @autoreleasepool {
        NSApplication *application = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        [application setDelegate:delegate];
        [application run];
    }
    return 0;
}