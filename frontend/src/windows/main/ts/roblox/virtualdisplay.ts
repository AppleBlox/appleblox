import { computer } from '@neutralinojs/lib';
import { getValue } from '../../components/settings';
import { libraryPath } from '../libraries';
import { shell, spawn, type SpawnEventEmitter } from '../tools/shell';
import Logger from '../utils/logger';

const logger = Logger.withContext('VirtualDisplay');

const GLOBAL_SETTINGS_PATH = '~/Library/Roblox/GlobalBasicSettings_13.xml';

let process: SpawnEventEmitter | null = null;
let originalFramerateCap: number | null = null;

export interface DisplayInfo {
	id: number;
	width: number;
	height: number;
	dpi: number;
	refreshRate: number;
}

export async function listDisplays(): Promise<DisplayInfo[]> {
	const raw = await computer.getDisplays();
	console.log(raw)
	return raw.map((d) => ({
		id: d.id,
		width: d.resolution.width,
		height: d.resolution.height,
		dpi: d.dpi,
		refreshRate: d.refreshRate,
	}));
}

async function getFramerateCap(): Promise<number | null> {
	try {
		const result = await shell(`grep FramerateCap ${GLOBAL_SETTINGS_PATH}`, [], { completeCommand: true, skipStderrCheck: true });
		const match = result.stdOut.match(/>(\d+)</);
		return match ? parseInt(match[1], 10) : null;
	} catch {
		return null;
	}
}

async function sedFramerateCap(hz: number): Promise<void> {
	const cmd = `sed -i "" "s/<int name=\\"FramerateCap\\">[0-9]*<\\/int>/<int name=\\"FramerateCap\\">${hz}<\\/int>/" ${GLOBAL_SETTINGS_PATH}`;
	await shell(cmd, [], { completeCommand: true, skipStderrCheck: true });
}

async function setFramerateCap(hz: number): Promise<void> {
	try {
		if (originalFramerateCap === null) {
			originalFramerateCap = await getFramerateCap();
		}
		await sedFramerateCap(hz);
		logger.info(`Set FramerateCap to ${hz}`);
	} catch (err) {
		logger.warn('Failed to update FramerateCap:', err);
	}
}

async function restoreFramerateCap(): Promise<void> {
	if (originalFramerateCap === null) return;
	try {
		await sedFramerateCap(originalFramerateCap);
		logger.info(`Restored FramerateCap to ${originalFramerateCap}`);
		originalFramerateCap = null;
	} catch (err) {
		logger.warn('Failed to restore FramerateCap:', err);
	}
}

export async function start(): Promise<void> {
	if (process) return;

	const vdPath = libraryPath('virtualdisplay');
	const args = ['--no-menu'];

	const vdHz = await getValue<number[]>('engine.graphics.vd_hz');
	const hz = vdHz?.[0] || 240;
	if (hz !== 240) {
		args.push('--hz', String(hz));
	}

	if (hz > 240) {
		await setFramerateCap(hz);
	}

	const vdWidth = await getValue<string>('engine.graphics.vd_width');
	if (vdWidth) {
		args.push('--width', vdWidth);
	}

	const vdHeight = await getValue<string>('engine.graphics.vd_height');
	if (vdHeight) {
		args.push('--height', vdHeight);
	}

	try {
		const vdDisplay = await getValue<string>('engine.graphics.vd_display');
		if (vdDisplay) {
			args.push('--display', vdDisplay);
		}
	} catch {}

	logger.info(`Starting virtual display (${args.join(' ')})`);
	process = await spawn(vdPath, args, { skipStderrCheck: true });
	process.on('stdErr', (data: string) => {
		if (data.includes('Error:')) {
			logger.error(`Virtual display error: ${data.trim()}`);
		}
	});
	process.on('exit', () => {
		process = null;
	});
}

export async function stop(): Promise<void> {
	if (!process) return;
	await process.kill(true);
	process = null;
	await restoreFramerateCap();
}

export function isRunning(): boolean {
	return process !== null;
}
