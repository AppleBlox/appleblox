<script lang="ts">
	import { LucideSettings } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import RobloxDownloadButton from '../components/roblox/roblox-download-button.svelte';
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import Roblox from '../ts/roblox';
	import { Notification } from '../ts/tools/notifications';
	import Logger from '@/windows/main/ts/utils/logger';

	export let render = true;

	const notificationTypes: any = {
		normal: () => ({
			title: 'Standard Notification',
			content: 'This is a standard notification with basic content.',
			contentImage: 'https://i.scdn.co/image/ab67616d00001e0227047720beaa8d2b4c236380',
			closeLabel: 'Close',
			dropdownLabel: 'Options',
			subtitle: 'System Message',
			sound: 'hero',
		}),
		reply: () => ({
			title: 'Reply Required',
			content: 'This notification requires a response from the user.',
			reply: true,
		}),
		action: () => ({
			title: 'Action Selection',
			content: 'Please select one of the available actions below.',
			actions: [
				{ label: 'Approve', value: 'approve' },
				{ label: 'Reject', value: 'reject' },
				{ label: 'Review', value: 'review' },
			],
		}),
		timeout: () => ({
			title: 'Timed Notification',
			content: 'This notification will automatically close in 5 seconds.',
			timeout: 5,
		}),
	};

	async function handleButtonClick(event: CustomEvent) {
		const { id } = event.detail as { id: string };

		switch (id) {
			case "backup":
				await handleBackupCreation();
				return;
			case "auth_ticket":
				// const authTicket = await getAuthTicketForAccount()
				// console.debug(authTicket)
				return;
		}

		const [action, type] = id.split('_');
		if (action in notificationTypes) {
			handleNotificationTest(action as keyof typeof notificationTypes);
		}
	}

	async function handleBackupCreation() {
		try {
			await Roblox.Mods.createBackup(true);
			toast.success('Backup created successfully', { duration: 3000 });
		} catch (error) {
			toast.error('Failed to create backup', { duration: 3000 });
			Logger.error('Backup creation failed:', error);
		}
	}

	function handleNotificationTest(type: keyof typeof notificationTypes) {
		const config = notificationTypes[type]();
		const notification = new Notification(config);

		notification.show();

		notification.on('clicked', () => {
			toast.info('Notification clicked');
		});

		if (type === 'reply') {
			notification.on('replied', (reply: string) => {
				toast.info(`Reply received: ${reply}`);
			});
		}

		if (type === 'action') {
			notification.on('action', (action: { label: string; value: string }) => {
				toast.info(`Action selected: ${action.label} (${action.value})`);
			});
		}

		if (type === 'timeout') {
			notification.on('timeout', () => {
				toast.info('Notification timed out');
			});
		}
	}

	// Get launch arguments from Neutralino
	const launchArgs = window.NL_ARGS.join(' ');

	const developmentPanel = new SettingsPanelBuilder()
		.setName('Development Panel')
		.setDescription('Tools and utilities for development and testing.')
		.setId('development')
		.addCategory((category) =>
			category
				.setName('Application Info')
				.setDescription('Information about the running application')
				.setId('appinfo')
				.addInput({
					label: 'Launch Arguments',
					description: 'Command-line arguments passed to Neutralino (read-only)',
					id: 'launch_args',
					default: launchArgs,
				})
		)
		.addCategory((category) =>
			category
				.setName('Interface Components')
				.setDescription('Test various UI components and widgets')
				.setId('components')
				.addButton({
					label: 'Standard Button',
					description: 'Basic button component',
					id: 'standard_button',
					variant: 'default',
				})
				.addCustom({
					label: 'Icon Component',
					description: 'Custom icon widget',
					id: 'icon_component',
					component: LucideSettings,
				})
				.addInput({
					label: 'Text Input',
					description: 'Standard text input field',
					id: 'text_input',
					default: '',
					blacklist: '!@#$%',
				})
				.addSelect({
					label: 'Dropdown Selection',
					description: 'Select from predefined options',
					id: 'dropdown_select',
					items: [
						{ label: 'Option A', value: 'option_a' },
						{ label: 'Option B', value: 'option_b' },
						{ label: 'Option C', value: 'option_c' },
					],
					default: 'option_a',
				})
				.addSlider({
					label: 'Value Slider',
					description: 'Numeric value selection',
					id: 'value_slider',
					max: 100,
					min: 0,
					step: 1,
					default: [50],
				})
				.addSwitch({
					label: 'Toggle Switch',
					description: 'Boolean value toggle',
					id: 'toggle_switch',
					default: false,
				})
				.addFilePicker({
					label: 'File Selection',
					description: 'Choose files from system',
					id: 'file_picker',
					accept: ['png', 'jpg', 'jpeg'],
				})
		)
		.addCategory((category) =>
			category
				.setName('Notification System')
				.setDescription('Test different notification types and behaviors')
				.setId('notifications')
				.addButton({
					label: 'Standard Notification',
					description: 'Display a basic notification',
					id: 'normal_test',
					variant: 'outline',
				})
				.addButton({
					label: 'Reply Notification',
					description: 'Notification with reply functionality',
					id: 'reply_test',
					variant: 'outline',
				})
				.addButton({
					label: 'Action Notification',
					description: 'Notification with action buttons',
					id: 'action_test',
					variant: 'outline',
				})
				.addButton({
					label: 'Timeout Notification',
					description: 'Auto-dismissing notification',
					id: 'timeout_test',
					variant: 'outline',
				})
		)
		.addCategory((category) =>
			category
				.setName('System Operations')
				.setDescription('System-level operations and utilities')
				.setId('system')
				.addButton({
					label: 'Create Backup',
					description: 'Generate a backup of Roblox resources',
					id: 'backup',
					variant: 'default',
				})
				.addCustom({
					component: RobloxDownloadButton,
					description: '',
					id: 'roblox_download',
					label: '',
					separator: false,
				})
		)
		.addCategory((category) =>
			category
				.setName('Advanced')
				.setDescription('Other things')
				.setId('advanced')
				.addButton({
					label: 'Get auth ticket',
					description: 'Prints the auth ticket',
					id: 'auth_ticket',
					variant: 'destructive',
				})
		)
		.build();
</script>

<div class="development-panel">
	<Panel panel={developmentPanel} {render} on:button={handleButtonClick} />
</div>

<style>
	.development-panel {
		min-height: 100vh;
		padding: 1rem;
	}
</style>
