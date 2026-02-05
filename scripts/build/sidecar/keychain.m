// Keychain Helper for AppleBlox
// Securely stores and retrieves credentials using macOS Keychain
// Usage:
//   keychain_ablox store <service> <account>    - Reads password from stdin
//   keychain_ablox retrieve <service> <account> - Outputs password to stdout
//   keychain_ablox delete <service> <account>   - Removes credential
//   keychain_ablox exists <service> <account>   - Checks if credential exists (exit 0 = yes, 1 = no)

#import <Foundation/Foundation.h>
#import <Security/Security.h>

// Security: Clear sensitive data from memory
void secureZeroMemory(void *ptr, size_t len) {
    volatile unsigned char *p = (volatile unsigned char *)ptr;
    while (len--) {
        *p++ = 0;
    }
}

// Store a credential in the Keychain
int storeCredential(NSString *service, NSString *account, NSString *password) {
    // First, try to delete any existing item
    NSDictionary *deleteQuery = @{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: service,
        (__bridge id)kSecAttrAccount: account,
    };
    SecItemDelete((__bridge CFDictionaryRef)deleteQuery);

    // Create the new item
    NSData *passwordData = [password dataUsingEncoding:NSUTF8StringEncoding];

    NSDictionary *addQuery = @{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: service,
        (__bridge id)kSecAttrAccount: account,
        (__bridge id)kSecValueData: passwordData,
        (__bridge id)kSecAttrAccessible: (__bridge id)kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        (__bridge id)kSecAttrSynchronizable: @NO,  // Don't sync to iCloud Keychain
    };

    OSStatus status = SecItemAdd((__bridge CFDictionaryRef)addQuery, NULL);

    if (status == errSecSuccess) {
        return 0;
    } else {
        NSLog(@"Failed to store credential. Error code: %d", (int)status);
        return 1;
    }
}

// Retrieve a credential from the Keychain
int retrieveCredential(NSString *service, NSString *account) {
    NSDictionary *query = @{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: service,
        (__bridge id)kSecAttrAccount: account,
        (__bridge id)kSecReturnData: @YES,
        (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitOne,
    };

    CFDataRef passwordData = NULL;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, (CFTypeRef *)&passwordData);

    if (status == errSecSuccess && passwordData != NULL) {
        NSData *data = (NSData *)passwordData;
        NSString *password = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];

        // Output to stdout (no newline to avoid parsing issues)
        printf("%s", [password UTF8String]);

        // Security: Clear the password string from memory
        char *passwordBytes = (char *)[password UTF8String];
        secureZeroMemory(passwordBytes, strlen(passwordBytes));

        return 0;
    } else if (status == errSecItemNotFound) {
        // Item not found - return exit code 2
        return 2;
    } else {
        NSLog(@"Failed to retrieve credential. Error code: %d", (int)status);
        return 1;
    }
}

// Delete a credential from the Keychain
int deleteCredential(NSString *service, NSString *account) {
    NSDictionary *query = @{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: service,
        (__bridge id)kSecAttrAccount: account,
    };

    OSStatus status = SecItemDelete((__bridge CFDictionaryRef)query);

    if (status == errSecSuccess || status == errSecItemNotFound) {
        return 0;
    } else {
        NSLog(@"Failed to delete credential. Error code: %d", (int)status);
        return 1;
    }
}

// Check if a credential exists in the Keychain
int checkExists(NSString *service, NSString *account) {
    NSDictionary *query = @{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: service,
        (__bridge id)kSecAttrAccount: account,
        (__bridge id)kSecReturnAttributes: @YES,
        (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitOne,
    };

    CFDictionaryRef result = NULL;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, (CFTypeRef *)&result);

    if (result != NULL) {
        CFRelease(result);
    }

    if (status == errSecSuccess) {
        printf("true");
        return 0;
    } else {
        printf("false");
        return 1;
    }
}

// Read password from stdin (for store command)
NSString *readPasswordFromStdin(void) {
    NSFileHandle *stdin = [NSFileHandle fileHandleWithStandardInput];
    NSData *inputData = [stdin readDataToEndOfFile];
    NSString *input = [[NSString alloc] initWithData:inputData encoding:NSUTF8StringEncoding];

    // Trim any trailing newlines
    return [input stringByTrimmingCharactersInSet:[NSCharacterSet newlineCharacterSet]];
}

void printUsage(const char *programName) {
    fprintf(stderr, "Usage:\n");
    fprintf(stderr, "  %s store <service> <account>    - Store credential (reads password from stdin)\n", programName);
    fprintf(stderr, "  %s retrieve <service> <account> - Retrieve credential (outputs to stdout)\n", programName);
    fprintf(stderr, "  %s delete <service> <account>   - Delete credential\n", programName);
    fprintf(stderr, "  %s exists <service> <account>   - Check if credential exists\n", programName);
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc < 4) {
            printUsage(argv[0]);
            return 1;
        }

        NSString *command = [NSString stringWithUTF8String:argv[1]];
        NSString *service = [NSString stringWithUTF8String:argv[2]];
        NSString *account = [NSString stringWithUTF8String:argv[3]];

        // Validate inputs
        if ([service length] == 0 || [account length] == 0) {
            fprintf(stderr, "Error: Service and account cannot be empty\n");
            return 1;
        }

        if ([command isEqualToString:@"store"]) {
            NSString *password = readPasswordFromStdin();

            if ([password length] == 0) {
                fprintf(stderr, "Error: Password cannot be empty\n");
                return 1;
            }

            int result = storeCredential(service, account, password);

            // Security: Clear password from memory
            char *passwordBytes = (char *)[password UTF8String];
            secureZeroMemory(passwordBytes, strlen(passwordBytes));

            return result;
        } else if ([command isEqualToString:@"retrieve"]) {
            return retrieveCredential(service, account);
        } else if ([command isEqualToString:@"delete"]) {
            return deleteCredential(service, account);
        } else if ([command isEqualToString:@"exists"]) {
            return checkExists(service, account);
        } else {
            fprintf(stderr, "Unknown command: %s\n", [command UTF8String]);
            printUsage(argv[0]);
            return 1;
        }
    }
    return 0;
}
