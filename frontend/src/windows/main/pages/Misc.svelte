<script lang="ts">
	import { os } from '@neutralinojs/lib';
	import { version } from '@root/package.json';
	import { FileArchive, FolderCog, FolderOpen, List } from 'lucide-svelte';
	import path from 'path-browserify';
	import { toast } from 'svelte-sonner';
	import { SettingsPanelBuilder, getConfigPath } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import { disableConsoleRedirection, enableConsoleRedirection } from '../ts/debugging';
	import Roblox from '../ts/roblox';
	import shellFS from '../ts/tools/shellfs';
	import { shell } from '../ts/tools/shell';

	export let render = true;

	let clearLogsPopup = false;

	async function buttonClicked(e: CustomEvent) {
		const { id } = e.detail;
		switch (id) {
			case 'redirect_console':
				enableConsoleRedirection();
				toast.success('Console redirection enabled', { duration: 1000 });
				break;
			case 'open_logs': {
				const logPath = path.join(path.dirname(await getConfigPath()), 'logs');
				if (!(await shellFS.exists(logPath))) {
					toast.error("The logs folder doesn't seem to exist.");
					return;
				}
				shellFS.open(logPath, { reveal: true });
				break;
			}
			case 'open_folder':
				shellFS.open(path.join(await os.getEnv('HOME'), 'Library', 'Application Support', 'AppleBlox'), { reveal: true });
				break;
			case 'open_roblox_folder':
				shellFS.open(path.join(Roblox.path, 'Contents'), { reveal: true });
				break;
			case 'export_config':
				const exportPath = await os.showFolderDialog('Where do you want to save the file?', {
					defaultPath: path.join(await os.getEnv('HOME'), 'Desktop'),
				});
				if (!exportPath || exportPath.length < 1) return; // User canceled

				const archivePath = path.join(exportPath, `abloxconfig-${version}.zip`);
				if (await shellFS.exists(archivePath)) {
					await shellFS.remove(archivePath);
				}
				const appleBloxPath = path.dirname(await getConfigPath());
				const lastFiveLogs = (
					await shell(`ls -tr "${path.join(appleBloxPath, 'logs')}" | tail -5`, [], { completeCommand: true })
				).stdOut
					.split('\n')
					.filter((file) => file.length > 0)
					.map((file) => `logs/${file}`);

				await shellFS.zip(archivePath, ['config', 'theme.css', ...lastFiveLogs], {
					recursive: true,
					cwd: appleBloxPath,
				});
				await shellFS.open(archivePath, { reveal: true });
				break;
		}
	}

	async function switchClicked(e: CustomEvent) {
		const { id, state } = e.detail;
		switch (id) {
			case 'redirect_console':
				if (state) {
					enableConsoleRedirection();
				} else {
					disableConsoleRedirection();
				}
				break;
		}
	}

	const panel = new SettingsPanelBuilder()
		.setName('System')
		.setDescription('System integration and debugging options')
		.setId('misc')
		.addCategory((category) =>
			category
				.setName('Settings')
				.setDescription('System preferences and debugging tools')
				.setId('advanced')
				.addSwitch({
					label: 'Notification Sounds',
					description: 'Enable sound for all AppleBlox notifications',
					id: 'notify_all',
					default: false,
				})
				.addSwitch({
					label: 'Log to File',
					description: 'Save all console output to log files (Recommended)',
					id: 'redirect_console',
					default: true,
				})
				.addButton({
					label: 'View Logs',
					description: 'Open the logs folder in Finder',
					id: 'open_logs',
					variant: 'default',
					icon: { component: FolderOpen },
				})
				.addButton({
					label: 'Export Settings',
					description: 'Save your logs and configuration as an archive',
					id: 'export_config',
					variant: 'secondary',
					icon: { component: FileArchive },
				})
				.addButton({
					label: 'AppleBlox Folder',
					description: 'Open AppleBlox application data folder',
					id: 'open_folder',
					variant: 'outline',
					icon: {
						component: FolderCog,
					},
				})
				.addButton({
					label: 'Roblox Folder',
					description: 'Open Roblox.app installation folder',
					id: 'open_roblox_folder',
					variant: 'outline',
					icon: {
						component: FolderOpen,
					},
				})
		)
		.build();
</script>

<Panel {panel} on:button={buttonClicked} on:switch={switchClicked} {render} />
