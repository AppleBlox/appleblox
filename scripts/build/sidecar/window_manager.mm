#import <Foundation/Foundation.h>
#import <ApplicationServices/ApplicationServices.h>

@interface WindowManager : NSObject
+ (BOOL)moveWindowToX:(int)x y:(int)y;
+ (BOOL)resizeWindowToWidth:(int)width height:(int)height;
+ (BOOL)setResolutionToWidth:(int)width height:(int)height duration:(int)duration;
@end

@implementation WindowManager

+ (AXUIElementRef)findRobloxWindow {
    ProcessSerialNumber psn = {0, kNoProcess};
    while (GetNextProcess(&psn) == noErr) {
        CFStringRef processName;
        if (CopyProcessName(&psn, &processName) == noErr) {
            if ([(NSString *)processName isEqualToString:@"Roblox"]) {
                CFRelease(processName);
                pid_t pid;
                GetProcessPID(&psn, &pid);
                AXUIElementRef app = AXUIElementCreateApplication(pid);
                CFArrayRef windowList;
                AXUIElementCopyAttributeValue(app, kAXWindowsAttribute, (CFTypeRef *)&windowList);
                if (CFArrayGetCount(windowList) > 0) {
                    AXUIElementRef window = (AXUIElementRef)CFArrayGetValueAtIndex(windowList, 0);
                    CFRetain(window);
                    CFRelease(windowList);
                    CFRelease(app);
                    return window;
                }
                CFRelease(windowList);
                CFRelease(app);
                break;
            }
            CFRelease(processName);
        }
    }
    return NULL;
}

+ (BOOL)moveWindowToX:(int)x y:(int)y {
    AXUIElementRef window = [self findRobloxWindow];
    if (!window) return NO;

    CGPoint position = CGPointMake(x, y);
    CFTypeRef positionRef = (CFTypeRef)(AXValueCreate(kAXValueCGPointType, (const void *)&position));
    AXError error = AXUIElementSetAttributeValue(window, kAXPositionAttribute, positionRef);
    
    if (positionRef) CFRelease(positionRef);
    CFRelease(window);
    return (error == kAXErrorSuccess);
}

+ (BOOL)resizeWindowToWidth:(int)width height:(int)height {
    AXUIElementRef window = [self findRobloxWindow];
    if (!window) return NO;

    CGSize size = CGSizeMake(width, height);
    CFTypeRef sizeRef = (CFTypeRef)(AXValueCreate(kAXValueCGSizeType, (const void *)&size));
    AXError error = AXUIElementSetAttributeValue(window, kAXSizeAttribute, sizeRef);
    
    if (sizeRef) CFRelease(sizeRef);
    CFRelease(window);
    return (error == kAXErrorSuccess);
}

+ (BOOL)setResolutionToWidth:(int)width height:(int)height duration:(int)duration {
    CGDirectDisplayID display = CGMainDisplayID();
    
    // Get current display mode
    CGDisplayModeRef originalMode = CGDisplayCopyDisplayMode(display);
    if (originalMode == NULL) {
        NSLog(@"Failed to get current display mode");
        return NO;
    }
    
    // Find and set new display mode
    CFArrayRef modes = CGDisplayCopyAllDisplayModes(display, NULL);
    CFIndex count = CFArrayGetCount(modes);
    BOOL modeFound = NO;
    
    for (CFIndex i = 0; i < count; ++i) {
        CGDisplayModeRef mode = (CGDisplayModeRef)CFArrayGetValueAtIndex(modes, i);
        int modeWidth = (int)CGDisplayModeGetWidth(mode);
        int modeHeight = (int)CGDisplayModeGetHeight(mode);
        
        if (modeWidth == width && modeHeight == height) {
            CGError err = CGDisplaySetDisplayMode(display, mode, NULL);
            if (err == kCGErrorSuccess) {
                NSLog(@"Resolution changed to %dx%d for %d seconds", width, height, duration);
                modeFound = YES;
                break;
            } else {
                NSLog(@"Failed to set display mode: %d", err);
            }
        }
    }
    
    CFRelease(modes);
    
    if (!modeFound) {
        NSLog(@"Failed to find matching resolution: %dx%d", width, height);
        CGDisplayModeRelease(originalMode);
        return NO;
    }
    
    // Wait for the specified duration
    [NSThread sleepForTimeInterval:duration];
    
    // Restore original resolution
    CGError err = CGDisplaySetDisplayMode(display, originalMode, NULL);
    CGDisplayModeRelease(originalMode);
    
    if (err == kCGErrorSuccess) {
        NSLog(@"Resolution restored to original setting");
        return YES;
    } else {
        NSLog(@"Failed to restore original resolution: %d", err);
        return NO;
    }
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc < 3) {
            NSLog(@"Usage: %s move|resize|setres <param1> <param2> [<param3>]", argv[0]);
            return 1;
        }

        NSString *command = [NSString stringWithUTF8String:argv[1]];

        if ([command isEqualToString:@"move"]) {
            int x = atoi(argv[2]);
            int y = atoi(argv[3]);
            return [WindowManager moveWindowToX:x y:y] ? 0 : 1;
        } else if ([command isEqualToString:@"resize"]) {
            int width = atoi(argv[2]);
            int height = atoi(argv[3]);
            return [WindowManager resizeWindowToWidth:width height:height] ? 0 : 1;
        } else if ([command isEqualToString:@"setres"]) {
            if (argc != 5) {
                NSLog(@"Usage: %s setres <width> <height> <duration>", argv[0]);
                return 1;
            }
            int width = atoi(argv[2]);
            int height = atoi(argv[3]);
            int duration = atoi(argv[4]);
            return [WindowManager setResolutionToWidth:width height:height duration:duration] ? 0 : 1;
        } else {
            NSLog(@"Invalid command");
            return 1;
        }
    }
    return 0;
}