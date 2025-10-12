<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { events, os } from '@neutralinojs/lib';
	import { version } from '@root/package.json';
	import { FileArchive, FolderCog, FolderOpen } from 'lucide-svelte';
	import path from 'path-browserify';
	import { getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { SettingsPanelBuilder, getConfigPath } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import Roblox from '../ts/roblox';
	import { shell } from '../ts/tools/shell';
	import shellFS from '../ts/tools/shellfs';

	const { getCurrentPage } = getContext('pageData') as { getCurrentPage: () => string };

	export let render = true;

	let exportSettingsPopup = false;

	// Had to do this because of a bug I couldn't fix
	events.on('exportSettings', () => {
		if (getCurrentPage() === 'misc') return;
		exportSettingsPopup = true;
	});

	async function exportSettings() {
		exportSettingsPopup = false;
		const formattedDate = new Date()
			.toLocaleString('en-GB', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: false,
			})
			.replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, '$1-$2-$3_$4-$5-$6');
		const archivePath = path.join(await os.getEnv('HOME'), `abloxconfig-${version}-${formattedDate}.zip`);
		if (await shellFS.exists(archivePath)) {
			await shellFS.remove(archivePath);
		}
		const appleBloxPath = path.dirname(await getConfigPath());
		const lastTenLogs = (
			await shell(`ls -tr "${path.join(appleBloxPath, 'logs')}" | tail -10`, [], { completeCommand: true })
		).stdOut
			.split('\n')
			.filter((file) => file.length > 0)
			.map((file) => `logs/${file}`);

		await shellFS.zip(archivePath, ['config', 'theme.css', ...lastTenLogs], {
			recursive: true,
			cwd: appleBloxPath,
		});
		toast.success('Your settings have been exported.', { duration: 3000 });
		await shellFS.open(archivePath, { reveal: true });
	}

	async function buttonClicked(e: CustomEvent) {
		const { id } = e.detail;
		switch (id) {
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
				exportSettingsPopup = true;
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
					label: 'Use alternative notifications',
					description:
						"Use AppleScript to show AppleBlox's notification. Less detailed, but may work better for some people.",
					id: 'alternative_notifications',
					default: false,
				})
				.addSwitch({
					label: 'Allow fixed fixed loading times',
					description:
						'Set a minimal time for loading steps during Roblox launching. That way, you can better see the bootstrapper.',
					id: 'allow_fixed_loading_times',
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

<Panel {panel} on:button={buttonClicked} {render} />
<AlertDialog.Root bind:open={exportSettingsPopup}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Export settings?</AlertDialog.Title>
			<AlertDialog.Description
				>You should only provide your settings when asked to in the AppleBlox Discord server or inside a GitHub issue.
				This option should only be used to get support, and not anything else.</AlertDialog.Description
			>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={exportSettings}>Export</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
