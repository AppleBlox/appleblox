import { events, os, clipboard } from '@neutralinojs/lib';
import { version } from '@root/package.json';
import path from 'path-browserify';
import type { SFSymbol } from 'sf-symbols-typescript';
import { libraryPath } from './libraries';
import { showNotification } from './notifications';
import Roblox from './roblox';
import type { RobloxGame } from './roblox/launch';
import { getMode, sleep } from './utils';

type IconType = SFSymbol | string;

interface BaseMenuItem {
	type: 'normal' | 'separator' | 'label' | 'checkbox';
	title: string;
	id: string;
	icon: IconType | null;
	isBold: boolean;
	isUnderlined: boolean;
	isDisabled: boolean;
}

interface NormalMenuItem extends BaseMenuItem {
	type: 'normal' | 'label';
}

interface SeparatorMenuItem extends BaseMenuItem {
	type: 'separator';
}

interface CheckboxMenuItem extends BaseMenuItem {
	type: 'checkbox';
	isChecked: boolean;
}

type MenuItem = NormalMenuItem | SeparatorMenuItem | CheckboxMenuItem;

interface TrayConfig {
	trayIcon: IconType;
	menuItems: MenuItem[];
	showQuitItem: boolean;
}

class TrayIconWrapper {
	private config: TrayConfig;
	private process: os.SpawnedProcess | null = null;
	private processId: number | null = null;

	constructor(config: TrayConfig) {
		this.config = config;
	}

	private async spawnProcess(): Promise<void> {
		const configString = JSON.stringify(this.config);
		const command = `${libraryPath('traybuilder')} --config '${configString}'`;

		try {
			const result = await os.spawnProcess(command);
			console.log('Started Tray Icon with command:');
			console.log(command);
			this.process = result;
			this.processId = result.id;
			console.log('Tray icon process spawned with ID:', this.processId);
			this.attachEventListeners();
		} catch (error) {
			console.error('Failed to spawn tray icon process:', error);
		}
	}

	private attachEventListeners(): void {
		if (this.processId) {
			events.on('spawnedProcess', (evt: any) => {
				if (evt.detail.id === this.processId && evt.detail.action === 'stdOut') {
					const output = evt.detail.data.trim();
					if (output.startsWith('clicked:')) {
						const id = output.split(':')[1].trim();
						events.dispatch('trayClick', { id });
					} else if (output.startsWith('toggled:')) {
						const [id, isCheckedStr] = output.split(':')[1].split(',');
						const isChecked = isCheckedStr === '1';
						events.dispatch('trayCheck', { id, isChecked });
					}
				}
			});
		}
	}

	private async findProcess(): Promise<void> {
		if (!this.processId) return;

		try {
			const processes = await os.getSpawnedProcesses();
			const foundProcess = processes.find((p) => p.id === this.processId);

			if (foundProcess) {
				console.log('Found existing tray icon process:', this.processId);
				this.process = foundProcess;
				this.attachEventListeners();
			} else {
				console.log('Tray icon process not found, respawning...');
				await this.spawnProcess();
			}
		} catch (error) {
			console.error('Error finding tray icon process:', error);
		}
	}

	async start(): Promise<void> {
		await this.spawnProcess();
	}

	async stop(): Promise<void> {
		if (this.process && this.processId) {
			try {
				await os.updateSpawnedProcess(this.processId, 'exit');
				console.log('Tray icon process stopped');
				this.process = null;
				this.processId = null;
			} catch (error) {
				console.error('Failed to stop tray icon process:', error);
			}
		}
	}

	async updateConfig(newConfig: Partial<TrayConfig>): Promise<void> {
		this.config = { ...this.config, ...newConfig };
		await this.stop();
		await this.start();
	}

	async checkAndRestart(): Promise<void> {
		if (!this.process || !this.processId) {
			console.log('No active tray icon process, starting...');
			await this.start();
		} else {
			await this.findProcess();
		}
	}

	getConfig(): TrayConfig {
		return this.config;
	}
}

let trayWrapper: TrayIconWrapper | null = null;
let lastOptions: TrayConfig | null = null;

const presets: { [key: string]: TrayConfig } = {
	normal: {
		trayIcon: path.join(window.NL_PATH, getMode() === 'dev' ? '/build/lib/MacOS/assets/tray.png' : '/lib/assets/tray.png'),
		menuItems: [
			{
				type: 'label',
				title: 'Currently not in a game',
				id: 'not',
				icon: 'gamecontroller.fill',
				isBold: false,
				isUnderlined: false,
				isDisabled: false,
			},
			{
				type: 'label',
				title: 'Rejoin last server',
				id: 'join_last',
				icon: 'door.left.hand.open',
				isBold: false,
				isUnderlined: false,
				isDisabled: true,
			},
			{
				type: 'separator',
				title: '',
				id: '',
				icon: null,
				isBold: false,
				isUnderlined: false,
				isDisabled: false,
			},
			{
				type: 'label',
				id: 'label',
				title: `Version ${version}`,
				icon: null,
				isBold: false,
				isUnderlined: false,
				isDisabled: true,
			},
			{
				type: 'normal',
				id: 'quit',
				title: 'Quit AppleBlox',
				icon: null,
				isBold: false,
				isUnderlined: false,
				isDisabled: false,
			},
		],
		showQuitItem: false,
	},
};

const robloxDetails: { serverIp: string | null; regionString: string | null; gameDetails: RobloxGame | null; joinLink: string | null } = {
	serverIp: null,
	regionString: null,
	gameDetails: null,
	joinLink: null,
};

let isDoingEvent = false;
const handler = async (evt: CustomEvent) => {
	if (isDoingEvent) return;
	isDoingEvent = true;
	switch (evt.detail.id) {
		case 'copy':
			if (!robloxDetails.joinLink) {
				showNotification({ title: "Couldn't copy", content: 'No saved server link was found. Make sure you have properly joined a game.', sound: true, timeout: 8 });
				break;
			}
			await clipboard.writeText(robloxDetails.joinLink);
			showNotification({ title: 'Link copied to clipboard!', content: 'Your server link was copied into your clipboard.', sound: true, timeout: 3 });
			break;
		case 'rejoin': {
			if (!robloxDetails.joinLink) {
				showNotification({ title: "Couldn't rejoin", content: 'No saved server link was found. Make sure you have properly joined a game.', sound: true, timeout: 8 });
				return;
			}
			const res = await os.showMessageBox('Are you sure?', 'You will be disconnected from your current server.', 'OK_CANCEL' as os.MessageBoxChoice, 'WARNING' as os.Icon);
			showNotification({ title: 'click', content: res });
			if (res === 'CANCEL') break;
			await Roblox.Utils.quit();
			await TrayController.stop();
			os.execCommand(`open ${robloxDetails.joinLink}`);
			events.broadcast('exitApp');
			break;
		}
		case 'join_last':
			if (!robloxDetails.joinLink) {
				showNotification({ title: "Couldn't rejoin", content: 'No saved server link was found. Make sure you have properly joined a game.', sound: true, timeout: 8 });
				return;
			}
			await Roblox.Utils.quit();
			await TrayController.stop();
			os.execCommand(`open ${robloxDetails.joinLink}`);
			events.broadcast('exitApp');
			break;
	}
	isDoingEvent = false;
};
events.off('trayClick', handler);
events.on('trayClick', handler);

let stoppingGame = false;
let trayEnabled = false;
class TrayController {
	static async set(config: TrayConfig) {
		if (!trayEnabled) return;
		if (trayWrapper) {
			await trayWrapper.stop();
		}
		await os.execCommand(`pkill -f "tray_ablox"`);
		trayWrapper = new TrayIconWrapper(config);
		await trayWrapper.start();
	}

	static async preset(preset: string) {
		if (!trayEnabled) return;
		if (!(preset in presets)) {
			console.error(`No Tray preset with name "${preset}"`);
			return;
		}
		await TrayController.set(presets[preset]);
	}

	static async setGameDetails(serverIp?: string, regionString?: string, gameDetails?: RobloxGame, joinLink?: string) {
		if (!trayEnabled) return;
		if (serverIp) robloxDetails.serverIp = serverIp;
		if (regionString) robloxDetails.regionString = regionString;
		if (gameDetails) robloxDetails.gameDetails = gameDetails;
		if (joinLink) robloxDetails.joinLink = joinLink;
		if (robloxDetails.serverIp && robloxDetails.regionString && robloxDetails.gameDetails && robloxDetails.joinLink) {
			await TrayController.setGame();
		}
	}

	static async setGame() {
		if (!trayEnabled) return;
		if (!(robloxDetails.serverIp && robloxDetails.regionString && robloxDetails.gameDetails && robloxDetails.joinLink)) return;

		TrayController.update({
			menuItems: [
				{
					type: 'label',
					id: 'playing',
					title: `Playing ${robloxDetails.gameDetails.name}`,
					icon: 'gamecontroller.fill',
					isBold: false,
					isDisabled: false,
					isUnderlined: false,
				},
				{
					type: 'label',
					id: 'creator',
					title: `by ${robloxDetails.gameDetails.name}`,
					icon: 'person.fill',
					isBold: false,
					isDisabled: false,
					isUnderlined: false,
				},
				{
					type: 'separator',
					id: 'sep',
					title: 'sep',
					icon: null,
					isBold: false,
					isDisabled: false,
					isUnderlined: false,
				},
				{
					type: 'label',
					id: 'region',
					title: `Located in ${robloxDetails.regionString}`,
					icon: 'globe',
					isBold: false,
					isDisabled: false,
					isUnderlined: false,
				},
				{
					type: 'label',
					id: 'ip',
					title: `Connected to ${robloxDetails.serverIp}`,
					icon: 'globe',
					isBold: false,
					isDisabled: false,
					isUnderlined: false,
				},
				{
					type: 'normal',
					id: 'rejoin',
					title: 'Rejoin server',
					icon: 'server.rack',
					isBold: false,
					isDisabled: false,
					isUnderlined: false,
				},
				{
					type: 'normal',
					id: 'copy',
					title: 'Copy join link',
					icon: 'doc.on.clipboard.fill',
					isBold: false,
					isDisabled: false,
					isUnderlined: false,
				},
				{
					type: 'separator',
					id: 'sep',
					title: 'sep',
					icon: null,
					isBold: false,
					isDisabled: false,
					isUnderlined: false,
				},
				{
					type: 'label',
					id: 'label',
					title: `Version ${version}`,
					icon: null,
					isBold: false,
					isUnderlined: false,
					isDisabled: true,
				},
				{
					type: 'normal',
					id: 'quit',
					title: 'Quit AppleBlox',
					icon: null,
					isBold: false,
					isUnderlined: false,
					isDisabled: false,
				},
			],
		});
	}

	static async stopGame() {
		if (!trayEnabled) return;
		if (stoppingGame) return;
		stoppingGame = true;
		robloxDetails.gameDetails = null;
		robloxDetails.serverIp = null;
		robloxDetails.regionString = null;
		if (trayWrapper && robloxDetails.joinLink) {
			const config = presets.normal;
			config.menuItems[1] = {
				type: 'normal',
				title: 'Rejoin last server',
				id: 'join_last',
				icon: 'door.left.hand.open',
				isBold: false,
				isUnderlined: false,
				isDisabled: false,
			};
			await TrayController.set(config);
		} else {
			TrayController.preset('normal');
		}
		stoppingGame = false;
	}

	static async update(config: Partial<TrayConfig>) {
		if (!trayEnabled) return;
		if (trayWrapper) {
			await trayWrapper.updateConfig(config);
		} else {
			trayWrapper = new TrayIconWrapper(lastOptions || { trayIcon: 'star.fill', showQuitItem: false, menuItems: [] });
			await trayWrapper.start();
		}
	}

	static async stop() {
		if (!trayEnabled) return;
		if (trayWrapper) {
			await trayWrapper.stop();
		}
		await os.execCommand(`pkill -f "tray_ablox"`);
		trayWrapper = null;
		lastOptions = null;
	}
}

export { TrayIconWrapper, TrayController, type TrayConfig, type MenuItem, type IconType };
