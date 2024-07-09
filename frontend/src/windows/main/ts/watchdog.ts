import { os, filesystem } from "@neutralinojs/lib";
import { libraryPath } from "./libraries";

export class AbloxWatchdog {
    private watchdogProcess: os.SpawnedProcess | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;

    async start() {
        try {
            // Start the watchdog script
            this.watchdogProcess = await os.spawnProcess(String(libraryPath("watchdog")));
            
            // Check if the watchdog actually started or if it exited immediately
            await new Promise(resolve => setTimeout(resolve, 100)); // Short delay to allow script to potentially exit
            
            const pidFileExists = await filesystem.getStats('/tmp/ablox_watchdog.pid').then(() => true).catch(() => false);
            if (!pidFileExists) {
                console.log("Watchdog was already running. Using existing instance.");
                this.watchdogProcess = null;
            } else {
                console.log("Watchdog started with PID:", this.watchdogProcess.pid);
            }

            // Start sending heartbeats
            this.startHeartbeat();
        } catch (error) {
            console.error("Failed to start watchdog:", error);
        }
    }

    private startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 1000);
    }

    private async sendHeartbeat() {
        try {
            const currentTime = Date.now().toString();
            await filesystem.writeFile('/tmp/ablox_heartbeat', currentTime);
        } catch (error) {
            console.error("Failed to send heartbeat:", error);
        }
    }

    async stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        // The watchdog script will exit on its own after not receiving heartbeats
        this.watchdogProcess = null;
        console.log("Watchdog stopped");
    }

    async restart() {
        await this.stop();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for watchdog to exit
        await this.start();
    }
}