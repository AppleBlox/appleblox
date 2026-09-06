import { app, computer } from '@neutralinojs/lib';
import { version } from '@root/package.json';
import { shell } from '../tools/shell';
import Logger, { getRecentErrors, type LogEntry } from '@/windows/main/ts/utils/logger';
import { loadSettings } from '@/windows/main/components/settings';

export interface DebugReport {
	os: { name: string; version: string; architecture: string };
	cpu: { model: string; frequency: number; architecture: string; logicalThreads: number };
	memory: { totalMB: number; availableMB: number; virtualTotalMB: number; virtualAvailableMB: number };
	displays: Array<{ width: number; height: number; dpi: number }>;
	app: { version: string; applicationId: string; neutralinoVersion: string };
	activeSettings: Record<string, unknown>;
	recentErrors: readonly LogEntry[];
}

export async function collectDebugReport(): Promise<DebugReport> {
	const [osInfo, cpuInfo, memoryInfo, displays, config, arch] = await Promise.all([
		computer.getOSInfo(),
		computer.getCPUInfo(),
		computer.getMemoryInfo(),
		computer.getDisplays(),
		app.getConfig(),
		shell('uname', ['-m']).then((r) => r.stdOut.trim()),
	]);

	let activeSettings: Record<string, unknown> = {};
	const panelIds = [
		'roblox.installation',
		'roblox.background',
		'roblox.behavior',
		'roblox.multi_instances',
		'engine.graphics',
		'engine.visual',
		'engine.advanced',
		'integrations.discord',
		'integrations.activity',
		'integrations.servers',
		'appearance.bootstrapper',
		'misc.advanced',
	];

	for (const panelId of panelIds) {
		try {
			const settings = await loadSettings(panelId);
			if (settings && Object.keys(settings).length > 0) {
				activeSettings[panelId] = settings;
			}
		} catch {
			// Panel may not exist or have no saved settings
		}
	}

	return {
		os: { name: osInfo.name, version: osInfo.version, architecture: arch },
		cpu: {
			model: cpuInfo.model,
			frequency: cpuInfo.frequency,
			architecture: cpuInfo.architecture,
			logicalThreads: cpuInfo.logicalThreads,
		},
		memory: {
			totalMB: Math.round(memoryInfo.physical.total / (1024 * 1024)),
			availableMB: Math.round(memoryInfo.physical.available / (1024 * 1024)),
			virtualTotalMB: Math.round(memoryInfo.virtual.total / (1024 * 1024)),
			virtualAvailableMB: Math.round(memoryInfo.virtual.available / (1024 * 1024)),
		},
		displays: displays.map((d) => ({
			width: d.resolution.width,
			height: d.resolution.height,
			dpi: d.dpi,
		})),
		app: {
			version,
			applicationId: config.applicationId,
			neutralinoVersion: window.NL_VERSION,
		},
		activeSettings,
		recentErrors: getRecentErrors(10),
	};
}

export function formatDebugReportAsText(report: DebugReport): string {
	const lines: string[] = [];
	const now = new Date();
	const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

	lines.push('=== AppleBlox Debug Report ===');
	lines.push(`Generated: ${timestamp}`);
	lines.push('');

	lines.push('--- System ---');
	lines.push(`OS: ${report.os.name} ${report.os.version} (${report.os.architecture})`);
	lines.push(
		`CPU: ${report.cpu.model} @ ${report.cpu.frequency} MHz (${report.cpu.logicalThreads} threads)`
	);
	lines.push(`RAM: ${report.memory.totalMB} MB total, ${report.memory.availableMB} MB available`);
	for (let i = 0; i < report.displays.length; i++) {
		const d = report.displays[i];
		lines.push(`Display ${i + 1}: ${d.width}x${d.height} @ ${d.dpi} DPI`);
	}
	lines.push('');

	lines.push('--- Application ---');
	lines.push(`Version: ${report.app.version}`);
	lines.push(`Neutralino: ${report.app.neutralinoVersion}`);
	lines.push(`Application ID: ${report.app.applicationId}`);
	lines.push('');

	lines.push('--- Active Settings ---');
	for (const [panelId, settings] of Object.entries(report.activeSettings)) {
		if (typeof settings === 'object' && settings !== null) {
			for (const [key, value] of Object.entries(settings as Record<string, unknown>)) {
				lines.push(`${panelId}.${key}: ${JSON.stringify(value)}`);
			}
		}
	}
	lines.push('');

	lines.push(`--- Recent Errors (last ${report.recentErrors.length}) ---`);
	if (report.recentErrors.length === 0) {
		lines.push('(none)');
	} else {
		for (const entry of report.recentErrors) {
			lines.push(entry.formatted);
		}
	}

	return lines.join('\n');
}

export async function logDebugInfo() {
	try {
		const report = await collectDebugReport();
		const text = formatDebugReportAsText(report);
		Logger.info('AppleBlox Debug Information:\n\n' + text);
	} catch (error: any) {
		Logger.error('Error collecting debug information:', error.message);
	}
}
