import { app, computer } from '@neutralinojs/lib';
import { version } from '@root/package.json';
import { shell } from '../tools/shell';

export async function logDebugInfo() {
	try {
		let debugInfo = '';

		// OS Info
		const osInfo = await computer.getOSInfo();
		debugInfo += 'OS Info:\n';
		debugInfo += `  Name: ${osInfo.name}\n`;
		debugInfo += `  Version: ${osInfo.version}\n`;
		debugInfo += `  Architecture: ${(await shell('uname', ['-m'])).stdOut}\n\n`;

		// CPU Info
		const cpuInfo = await computer.getCPUInfo();
		debugInfo += 'CPU Info:\n';
		debugInfo += `  Model: ${cpuInfo.model}\n`;
		debugInfo += `  Frequency: ${cpuInfo.frequency} MHz\n`;
		debugInfo += `  Architecture: ${cpuInfo.architecture}\n`;
		debugInfo += `  Logical Threads: ${cpuInfo.logicalThreads}\n\n`;

		// Memory Info
		const memoryInfo = await computer.getMemoryInfo();
		debugInfo += 'Memory Info:\n';
		debugInfo += `  Physical Total: ${Math.round(memoryInfo.physical.total / (1024 * 1024))} MB\n`;
		debugInfo += `  Physical Available: ${Math.round(memoryInfo.physical.available / (1024 * 1024))} MB\n`;
		debugInfo += `  Virtual Total: ${Math.round(memoryInfo.virtual.total / (1024 * 1024))} MB\n`;
		debugInfo += `  Virtual Available: ${Math.round(memoryInfo.virtual.available / (1024 * 1024))} MB\n\n`;

		// Display Info
		const displays = await computer.getDisplays();
		debugInfo += 'Display Info:\n';
		displays.forEach((display, index) => {
			debugInfo += `  Display ${index + 1}:\n`;
			debugInfo += `    Resolution: ${display.resolution.width}x${display.resolution.height}\n`;
			debugInfo += `    DPI: ${display.dpi}\n`;
		});
		debugInfo += '\n';

		// Application Info
		const config = await app.getConfig();
		debugInfo += 'Application Info:\n';
		debugInfo += `  Version: ${version}\n`;
		debugInfo += `  Application ID: ${config.applicationId}\n\n`;

		// Neutralino Version
		debugInfo += 'Neutralino Info:\n';
		debugInfo += `  Version: ${window.NL_VERSION}\n\n`;

		// Log the debug info
		console.info('AppleBlox Debug Information:\n\n' + debugInfo);
	} catch (error: any) {
		console.error('Error collecting debug information:', error.message);
	}
}
