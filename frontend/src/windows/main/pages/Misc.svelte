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
				const configPath = await getConfigPath();
				const logPath = path.join(path.dirname(configPath), 'appleblox.log');
				const exportPath = await os.showFolderDialog('Where do you want to save the file?', {
					defaultPath: path.join(await os.getEnv('HOME'), 'Desktop'),
				});
				if (!exportPath || exportPath.length < 1) return; // User canceled
				const archivePath = path.join(exportPath, `abloxconfig-${version}.zip`);
				if (await shellFS.exists(archivePath)) {
					await shellFS.remove(archivePath);
				}
				await shellFS.zip(archivePath, [path.basename(logPath), path.basename(configPath)], {
					recursive: true,
					cwd: path.dirname(configPath),
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
		.setName('Miscellaneous')
		.setDescription("Other features that don't have their own tab")
		.setId('misc')
		.addCategory((category) =>
			category
				.setName('Other')
				.setDescription("Features that don't really have a category")
				.setId('advanced')
				.addSwitch({
					label: 'Enable sound for all notifications',
					description: 'Plays a sound for every AppleBlox notification',
					id: 'notify_all',
					default: false,
				})
				.addSwitch({
					label: 'Redirect logs to file',
					description: 'Redirect every console.log(), etc... to the logs file. (Recommended: ON)',
					id: 'redirect_console',
					default: true,
				})
				.addButton({
					label: 'Open logs folder',
					description: 'Opens the logs folder in finder',
					id: 'open_logs',
					variant: 'default',
					icon: { component: FolderOpen },
				})
				.addButton({
					label: 'Export configuration',
					description: 'Exports your logs and config folder as an archive',
					id: 'export_config',
					variant: 'secondary',
					icon: { component: FileArchive },
				})
				.addButton({
					label: 'Open AppleBlox folder',
					description: 'Opens the AppleBlox folder in Finder',
					id: 'open_folder',
					variant: 'outline',
					icon: {
						component: FolderCog,
					},
				})
				.addButton({
					label: 'Open Roblox app folder',
					description: 'Opens the Roblox.app folder in Finder',
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
