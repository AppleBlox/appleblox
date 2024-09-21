#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <signal.h>
#include <sys/types.h>
#include <errno.h>

int main() {
    // Get the parent process ID (PPID)
    pid_t parent_pid = getppid();
    pid_t piped_process_pid = getpid();

    // Monitor the parent process (your app/shell)
    while (1) {
        // Check if the parent process is still running
        if (kill(parent_pid, 0) == -1) {
            if (errno == ESRCH) {
                // Parent process doesn't exist, terminate the piped process
                printf("Parent process exited. Exiting watchdog and terminating piped process.\n");
                exit(0);
            } else {
                perror("Error checking parent process");
                exit(1);
            }
        }

        // Sleep a bit to avoid busy-looping (adjust as necessary)
        sleep(1);
    }

    return 0;
}
