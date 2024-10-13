#import <Foundation/Foundation.h>

@interface FileWatcher : NSObject
@property (nonatomic, copy) NSString *filePath;
@property (nonatomic, strong) dispatch_source_t source;
@property (nonatomic, assign) int fileDescriptor;
@property (nonatomic, strong) NSFileHandle *fileHandle;
@property (nonatomic, assign) unsigned long long lastFileSize;

- (instancetype)initWithFilePath:(NSString *)filePath;
- (void)startWatching;
- (void)stopWatching;
@end

@implementation FileWatcher

- (instancetype)initWithFilePath:(NSString *)filePath {
    self = [super init];
    if (self) {
        _filePath = [filePath copy];
        _lastFileSize = 0;
    }
    return self;
}

- (void)startWatching {
    NSError *error = nil;
    self.fileHandle = [NSFileHandle fileHandleForReadingFromURL:[NSURL fileURLWithPath:self.filePath] error:&error];
    if (error) {
        NSLog(@"Error opening file: %@", error);
        return;
    }

    self.fileDescriptor = self.fileHandle.fileDescriptor;
    if (self.fileDescriptor < 0) {
        NSLog(@"Invalid file descriptor");
        return;
    }

    [self updateLastFileSize];

    self.source = dispatch_source_create(DISPATCH_SOURCE_TYPE_VNODE, self.fileDescriptor,
                                         DISPATCH_VNODE_WRITE | DISPATCH_VNODE_EXTEND,
                                         dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0));

    dispatch_source_set_event_handler(self.source, ^{
        [self handleFileChange];
    });

    dispatch_resume(self.source);
}

- (void)stopWatching {
    if (self.source) {
        dispatch_source_cancel(self.source);
        self.source = NULL;
    }
    [self.fileHandle closeFile];
}

- (void)updateLastFileSize {
    NSError *error = nil;
    NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:self.filePath error:&error];
    if (error) {
        NSLog(@"Error getting file attributes: %@", error);
        return;
    }
    self.lastFileSize = [attributes fileSize];
}

- (void)handleFileChange {
    [self.fileHandle seekToFileOffset:self.lastFileSize];
    
    NSData *newData;
    if (@available(macOS 10.15, *)) {
        NSError *error = nil;
        newData = [self.fileHandle readDataToEndOfFileAndReturnError:&error];
        if (error) {
            NSLog(@"Error reading file: %@", error);
            return;
        }
    } else {
        newData = [self.fileHandle readDataToEndOfFile];
    }

    NSString *newContent = [[NSString alloc] initWithData:newData encoding:NSUTF8StringEncoding];
    
    if (newContent) {
        NSArray *lines = [newContent componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]];
        NSMutableArray *cleanLines = [NSMutableArray array];
        
        for (NSString *line in lines) {
            if (line.length > 0) {
                NSData *lineData = [line dataUsingEncoding:NSUTF8StringEncoding allowLossyConversion:YES];
                NSString *cleanLine = [[NSString alloc] initWithData:lineData encoding:NSUTF8StringEncoding];
                [cleanLines addObject:cleanLine];
            }
        }
        
        if (cleanLines.count > 0) {
            [self outputLines:cleanLines];
        }
    }
    
    [self updateLastFileSize];
}

- (void)outputLines:(NSArray *)lines {
    NSError *jsonError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:lines options:0 error:&jsonError];
    if (jsonData) {
        NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        printf("%s\n", [jsonString UTF8String]);
        fflush(stdout);  // Ensure the output is flushed immediately
    } else {
        NSLog(@"Error creating JSON: %@", jsonError);
    }
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc != 2) {
            NSLog(@"Usage: %s <file_path>", argv[0]);
            return 1;
        }
        
        NSString *filePath = [NSString stringWithUTF8String:argv[1]];
        FileWatcher *watcher = [[FileWatcher alloc] initWithFilePath:filePath];
        [watcher startWatching];
        
        [[NSRunLoop currentRunLoop] run];
    }
    return 0;
}