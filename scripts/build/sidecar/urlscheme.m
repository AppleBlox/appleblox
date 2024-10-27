// Change the handler for an URI
#import <Foundation/Foundation.h>
#import <ApplicationServices/ApplicationServices.h>

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc != 4) {
            NSLog(@"Usage: %s <set/check> <URL_SCHEME> <BUNDLE_IDENTIFIER>", argv[0]);
            return 1;
        }
        
        NSString *command = [NSString stringWithUTF8String:argv[1]];
        NSString *urlScheme = [NSString stringWithUTF8String:argv[2]];
        NSString *bundleIdentifier = [NSString stringWithUTF8String:argv[3]];
        
        if ([command isEqualToString:@"set"]) {
            OSStatus status = LSSetDefaultHandlerForURLScheme((CFStringRef)urlScheme, (CFStringRef)bundleIdentifier);
            
            if (status == noErr) {
                NSLog(@"Successfully set %@ as the default handler for %@://", bundleIdentifier, urlScheme);
                return 0;
            } else {
                NSLog(@"Failed to set default handler. Error code: %d", (int)status);
                return 1;
            }
        } else if ([command isEqualToString:@"check"]) {
            CFStringRef currentHandler = LSCopyDefaultHandlerForURLScheme((CFStringRef)urlScheme);
            
            if (currentHandler) {
                BOOL isDefault = [(NSString *)currentHandler isEqualToString:bundleIdentifier];
                CFRelease(currentHandler);
                
                NSLog(@"%@", isDefault ? @"true" : @"false");
                return isDefault ? 0 : 1;
            } else {
                NSLog(@"No default handler found for %@://", urlScheme);
                return 1;
            }
        } else {
            NSLog(@"Invalid command. Use 'set' to set the handler or 'check' to check the handler.");
            return 1;
        }
    }
    return 0;
}