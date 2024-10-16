#import <Foundation/Foundation.h>
#import <signal.h>

@interface FileWatcher : NSObject
@property (nonatomic, copy) NSString *filePath;
@property (nonatomic, strong) dispatch_source_t source;
@property (nonatomic, assign) int fileDescriptor;
@property (nonatomic, assign) unsigned long long lastFileSize;
@property (nonatomic, strong) dispatch_queue_t queue;
@property (nonatomic, strong) dispatch_source_t timer;
@property (nonatomic, strong) dispatch_source_t parentCheckTimer;
@property (nonatomic, copy) NSString *outputFilePath;

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
        _queue = dispatch_queue_create("com.appleblox.filewatcher", DISPATCH_QUEUE_SERIAL);
        [self setupOutputFile];
    }
    return self;
}

- (void)setupOutputFile {
    NSString *tmpDir = NSTemporaryDirectory();
    NSString *outputDir = [tmpDir stringByAppendingPathComponent:@"rlogs_ablox"];
    
    NSFileManager *fileManager = [NSFileManager defaultManager];
    if (![fileManager fileExistsAtPath:outputDir]) {
        NSError *error = nil;
        [fileManager createDirectoryAtPath:outputDir withIntermediateDirectories:YES attributes:nil error:&error];
        if (error) {
            [self logMessage:[NSString stringWithFormat:@"Error creating output directory: %@", error]];
            return;
        }
    }
    
    self.outputFilePath = [outputDir stringByAppendingPathComponent:@"output.log"];
}

- (void)startWatching {
    [self setupSignalHandler];
    [self setupFileWatcher];
    [self setupPeriodicCheck];
    [self setupParentProcessCheck];
}

- (void)setupSignalHandler {
    signal(SIGHUP, SIG_IGN);
    dispatch_source_t signalSource = dispatch_source_create(DISPATCH_SOURCE_TYPE_SIGNAL, SIGHUP, 0, dispatch_get_main_queue());
    dispatch_source_set_event_handler(signalSource, ^{
        [self logMessage:@"Received SIGHUP, exiting..."];
        exit(0);
    });
    dispatch_resume(signalSource);
}

- (void)setupFileWatcher {
    self.fileDescriptor = open([self.filePath UTF8String], O_RDONLY);
    if (self.fileDescriptor < 0) {
        [self logMessage:[NSString stringWithFormat:@"Error opening file: %s", strerror(errno)]];
        return;
    }

    [self updateLastFileSize];

    self.source = dispatch_source_create(DISPATCH_SOURCE_TYPE_VNODE, self.fileDescriptor,
                                         DISPATCH_VNODE_DELETE | DISPATCH_VNODE_WRITE | DISPATCH_VNODE_EXTEND | DISPATCH_VNODE_ATTRIB | DISPATCH_VNODE_LINK | DISPATCH_VNODE_RENAME | DISPATCH_VNODE_REVOKE,
                                         self.queue);

    dispatch_source_set_event_handler(self.source, ^{
        [self handleFileChange];
    });

    dispatch_source_set_cancel_handler(self.source, ^{
        close(self.fileDescriptor);
    });

    dispatch_resume(self.source);
}

- (void)setupPeriodicCheck {
    self.timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, self.queue);
    dispatch_source_set_timer(self.timer, dispatch_time(DISPATCH_TIME_NOW, 5 * NSEC_PER_SEC), 5 * NSEC_PER_SEC, 1 * NSEC_PER_SEC);
    
    dispatch_source_set_event_handler(self.timer, ^{
        [self performManualCheck];
    });
    
    dispatch_resume(self.timer);
}

- (void)setupParentProcessCheck {
    self.parentCheckTimer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, self.queue);
    dispatch_source_set_timer(self.parentCheckTimer, dispatch_time(DISPATCH_TIME_NOW, 1 * NSEC_PER_SEC), 1 * NSEC_PER_SEC, 0.1 * NSEC_PER_SEC);
    
    dispatch_source_set_event_handler(self.parentCheckTimer, ^{
        if (getppid() == 1) {
            [self logMessage:@"Parent process disconnected, exiting..."];
            exit(0);
        }
    });
    
    dispatch_resume(self.parentCheckTimer);
}

- (void)performManualCheck {
    NSError *error = nil;
    NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:self.filePath error:&error];
    if (error) {
        [self logMessage:[NSString stringWithFormat:@"Error getting file attributes: %@", error]];
        return;
    }
    
    unsigned long long currentFileSize = [attributes fileSize];
    if (currentFileSize > self.lastFileSize) {
        [self logMessage:@"Manual check detected new content. Rewatching file."];
        [self stopWatching];
        [self startWatching];
    }
}

- (void)stopWatching {
    if (self.source) {
        dispatch_source_cancel(self.source);
        self.source = NULL;
    }
    if (self.timer) {
        dispatch_source_cancel(self.timer);
        self.timer = NULL;
    }
    if (self.parentCheckTimer) {
        dispatch_source_cancel(self.parentCheckTimer);
        self.parentCheckTimer = NULL;
    }
}

- (void)updateLastFileSize {
    NSError *error = nil;
    NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:self.filePath error:&error];
    if (error) {
        [self logMessage:[NSString stringWithFormat:@"Error getting file attributes: %@", error]];
        return;
    }
    self.lastFileSize = [attributes fileSize];
}

- (void)handleFileChange {
    NSFileHandle *fileHandle = [NSFileHandle fileHandleForReadingAtPath:self.filePath];
    [fileHandle seekToFileOffset:self.lastFileSize];
    
    NSData *newData = [fileHandle readDataToEndOfFile];
    [fileHandle closeFile];

    if (newData.length > 0) {
        [self processNewData:newData];
    }
    
    [self updateLastFileSize];
}

- (void)processNewData:(NSData *)newData {
    NSString *newContent = [[NSString alloc] initWithData:newData encoding:NSUTF8StringEncoding];
    if (!newContent) {
        [self logMessage:@"Error: Unable to decode data as UTF-8"];
        return;
    }
    
    NSArray *lines = [newContent componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]];
    NSMutableArray *cleanLines = [NSMutableArray array];
    
    for (NSString *line in lines) {
        if (line.length > 0) {
            [cleanLines addObject:line];
        }
    }
    
    if (cleanLines.count > 0) {
        [self outputLines:cleanLines];
    }
}

- (void)outputLines:(NSArray *)lines {
    NSError *jsonError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:lines options:0 error:&jsonError];
    if (jsonData) {
        NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        
        // Output to stdout
        printf("%s\n", [jsonString UTF8String]);
        fflush(stdout);
        
        // Output to file
        if (self.outputFilePath) {
            NSFileHandle *fileHandle = [NSFileHandle fileHandleForWritingAtPath:self.outputFilePath];
            if (!fileHandle) {
                [[NSFileManager defaultManager] createFileAtPath:self.outputFilePath contents:nil attributes:nil];
                fileHandle = [NSFileHandle fileHandleForWritingAtPath:self.outputFilePath];
            }
            [fileHandle seekToEndOfFile];
            [fileHandle writeData:[jsonString dataUsingEncoding:NSUTF8StringEncoding]];
            [fileHandle writeData:[@"\n" dataUsingEncoding:NSUTF8StringEncoding]];
            [fileHandle closeFile];
        }
    } else {
        [self logMessage:[NSString stringWithFormat:@"Error creating JSON: %@", jsonError]];
    }
}

- (void)logMessage:(NSString *)message {
    fprintf(stderr, "message:%s\n", [message UTF8String]);
    fflush(stderr);
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        // Set stdout to line buffering
        setvbuf(stdout, NULL, _IOLBF, 0);

        if (argc != 2) {
            fprintf(stderr, "message:Usage: %s <file_path>\n", argv[0]);
            return 1;
        }

        NSString *filePath = [NSString stringWithUTF8String:argv[1]];
        FileWatcher *watcher = [[FileWatcher alloc] initWithFilePath:filePath];
        [watcher startWatching];

        dispatch_main();
    }
    return 0;
}