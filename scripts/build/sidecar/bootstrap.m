#import <Cocoa/Cocoa.h>

@interface AppDelegate : NSObject <NSApplicationDelegate>
@property (nonatomic, strong) NSTask *mainTask;
@property (nonatomic, strong) NSPipe *outputPipe;
@property (nonatomic, strong) NSFileHandle *logFileHandle;
@property (nonatomic, strong) NSString *deeplinkArgument;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
    [self setupLogging];
    [self logMessage:@"Application did finish launching"];
    
    // Check if we were launched with a URL
    NSArray *arguments = [[NSProcessInfo processInfo] arguments];
    for (NSString *arg in arguments) {
        if ([arg hasPrefix:@"--deeplink="]) {
            self.deeplinkArgument = arg;
            [self logMessage:[NSString stringWithFormat:@"App launched with URL: %@", self.deeplinkArgument]];
            [self terminateOtherInstances];
            break;
        }
    }
    
    [self launchMainExecutable];
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

- (void)launchMainExecutable {
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
        [self logMessage:@"Main executable launched successfully"];
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
    }
    [[self.outputPipe fileHandleForReading] readInBackgroundAndNotify];
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

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *application = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        [application setDelegate:delegate];
        [application run];
    }
    return 0;
}