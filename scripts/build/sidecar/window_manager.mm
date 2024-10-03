// Move, resize, etc... the Roblox window
#import <Foundation/Foundation.h>
#import <ApplicationServices/ApplicationServices.h>

@interface WindowManager : NSObject
+ (BOOL)moveWindowToX:(int)x y:(int)y;
+ (BOOL)resizeWindowToWidth:(int)width height:(int)height;
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

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc != 4) {
            NSLog(@"Usage: %s move|resize <param1> <param2>", argv[0]);
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
        } else {
            NSLog(@"Invalid command");
            return 1;
        }
    }
    return 0;
}