<script lang="ts">
	import { LucideAArrowUp } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { SettingsPanelBuilder } from '../components/settings';
	import Panel from '../components/settings/panel.svelte';
	import { Notification } from '../ts/tools/notifications';
	import Roblox from '../ts/roblox';
	import { window as win } from '@neutralinojs/lib';
	import { getMode } from '../ts/utils';

	export let render = true;

	async function onButtonClick(e: CustomEvent) {
		const { id } = e.detail as { id: string };
		if (!id.endsWith('_notif')) {
			switch (id) {
				case 'backup':
					try {
						Roblox.Mods.createBackup(true);
						toast.success('Created backup :3', { duration: 3000 });
					} catch (err) {
						toast.error("Couldn't create backup", { duration: 3000 });
						console.error(err);
					}
					break;
				case 'bootstrapper':
					toast.error("This feature is still in dev.")
					break;
					// const res = await Roblox.Window.getDesktopSize();
					// await win.create(getMode() === 'dev' ? 'http://localhost:5173/bootstrapper.html' : '/bootstrapper.html', {
					// 	alwaysOnTop: false,
					// 	width: 500,
					// 	height: 400,
					// 	borderless: false,
					// 	resizable: true,
					// 	useSavedState: false,
					// 	exitProcessOnClose: true,
					// 	title: 'AppleBlox Bootstrapper',
					// 	x: res.width / 2,
					// 	y: res.height / 2,
					// 	processArgs: '--window-transparent=true --window-enable-inspector=true --window-center=true',
					// });
			}
		}
		const action = id.split('_')[0];
		switch (action) {
			case 'normal': {
				const notif = new Notification({
					title: 'Hello world',
					content: 'Hiiii :3',
					contentImage: 'https://i.scdn.co/image/ab67616d00001e0227047720beaa8d2b4c236380',
					closeLabel: 'Close now',
					dropdownLabel: 'The menu thingy',
					subtitle: 'une tuile',
					sound: 'hero',
				});
				notif.show();
				notif.on('clicked', () => {
					toast.info('Notif clicked');
				});
				break;
			}
			case 'reply': {
				const notif = new Notification({
					title: 'Reply notif',
					content: 'aw hewl nah',
					reply: true,
				});
				notif.show();
				notif.on('clicked', () => {
					toast.info('Notif clicked');
				});
				notif.on('replied', (reply) => {
					toast.info(`Notif replied to: ${reply}`);
				});
				break;
			}
			case 'action': {
				const notif = new Notification({
					title: 'Action thingy',
					content: 'kewl :D',
					actions: [
						{ label: 'This', value: 'this' },
						{ label: 'Aber', value: 'aber' },
						{ label: 'Schokolade', value: 'chocolat' },
					],
				});
				notif.show();
				notif.on('clicked', () => {
					toast.info('Notif clicked');
				});
				notif.on('action', (action) => {
					toast.info(`Notif action "${action.label}": "${action.value}"`);
				});
				break;
			}
			case 'timeout': {
				const notif = new Notification({
					title: 'Timeout clock',
					content: 'This will be gone in 5 seconds',
					timeout: 5,
				});
				notif.show();
				notif.on('clicked', () => {
					toast.info('Notif clicked');
				});
				notif.on('timeout', () => {
					toast.info('Notification timeout');
				});
				break;
			}
		}
	}

	const devPanel = new SettingsPanelBuilder()
		.setName('Dev Panel')
		.setDescription('A panel to test dev things.')
		.setId('dev')
		.addCategory((category) =>
			category
				.setName('Widgets')
				.setDescription('All possible widgets')
				.setId('widgets')
				.addButton({ label: 'Button', description: 'Button Widget', id: 'button', variant: 'default' })
				.addCustom({
					label: 'Custom',
					description: 'Custom Widget',
					id: 'custom',
					component: LucideAArrowUp,
				})
				.addEmpty({ label: 'Empty', description: 'Empty Widget', id: 'empty' })
				.addFilePicker({
					label: 'Filepicker All',
					description: 'Filepicker Widget (Accepts Anything)',
					id: 'filepicker_all',
				})
				.addFilePicker({
					label: 'Filepicker Png',
					description: 'Filepicker Widget (Accepts only Png)',
					id: 'filepicker_png',
					accept: ['png'],
				})
				.addInput({ label: 'Input', description: 'Input Widget', id: 'input', default: '', blacklist: '!?123' })
				.addSelect({
					label: 'Select',
					description: 'Select Widget',
					id: 'select',
					items: [
						{ label: 'Element one', value: 'one' },
						{ label: 'Another', value: 'another' },
					],
					default: 'one',
				})
				.addSlider({
					label: 'Slider',
					description: 'Slider Widget',
					id: 'slider',
					max: 100,
					min: 1,
					step: 1,
					default: [10],
				})
				.addSlider({
					label: 'Slider Step',
					description: 'Slider Step Widget',
					id: 'slider_step',
					max: 100,
					min: 1,
					step: 0.5,
					default: [10.5],
				})
				.addSwitch({ label: 'Switch', description: 'switch', id: 'switch', default: true })
				.addButton({
					label: 'Test toggle step',
					description: 'Requires Slider Step value [35.5]',
					id: 'slider_step_toggle_test',
					variant: 'default',
					toggleable: { id: 'slider_step', type: 'slider', value: [36.5] },
				})
				.addSelect({
					label: 'Test toggle input',
					description: 'Requires input value "balls"',
					id: 'select_toggle_test',
					items: [
						{ label: 'Default', value: 'default' },
						{ label: 'An option!!', value: 'option' },
					],
					default: 'default',
					toggleable: {
						id: 'input',
						type: 'input',
						value: 'balls',
					},
				})
		)
		.addCategory((category) =>
			category
				.setName('Notifications')
				.setDescription('test notifs :3')
				.setId('notifications')
				.addButton({
					label: 'Normal',
					description: 'Normal notification',
					id: 'normal_notif',
					variant: 'outline',
				})
				.addButton({
					label: 'Reply',
					description: 'Reply notification',
					id: 'reply_notif',
					variant: 'outline',
				})
				.addButton({
					label: 'Action',
					description: 'Action notification',
					id: 'action_notif',
					variant: 'outline',
				})
				.addButton({
					label: 'Timeout',
					description: 'Timeout notification',
					id: 'timeout_notif',
					variant: 'outline',
				})
		)
		.addCategory((category) =>
			category
				.setName('Others')
				.setId('others')
				.setDescription('balls')
				.addButton({
					label: 'Create Resources backup',
					description: "Saves the Roblox's resources inside AppleBlox/cache",
					id: 'backup',
					variant: 'default',
				})
				.addButton({
					label: 'Create bootstrapper window',
					description: '',
					id: 'bootstrapper',
					variant: 'default',
				})
		)
		.build();
</script>

<div>
	<Panel panel={devPanel} {render} on:button={onButtonClick} />
	<h2>Args: "{window.NL_ARGS}"</h2>
</div>
