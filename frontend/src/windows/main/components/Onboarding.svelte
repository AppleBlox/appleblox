<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { toast } from 'svelte-sonner';
	import Roblox from '../ts/roblox';
	import { loadSettings, saveSettings, setValue } from './settings';

	let settings = null;
	let show = false;
	let shortcutAndUrl = false;
	loadSettings('onboarding').then((s) => {
		if (s) {
			settings = s;
			if (s.show) {
				show = true;
			}
		} else {
			saveSettings('onboarding', { show: true });
			show = true;
		}
	});
</script>

<AlertDialog.Root bind:open={show}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Welcome to AppleBlox</AlertDialog.Title>
			<AlertDialog.Description>
				<p>
					We are thrilled to have you here! For starters, you should check out the <strong
						>Integrations & FastFlags
					</strong>tab.
				</p>
				<p>
					If you want to add <strong>Mods</strong>, you should join the AppleBlox or Bloxstrap Discord server from the
					support/mods tab.
				</p>
				<br />
				<p>
					🌟 Don't forget to leave a <strong>Star</strong> on the
					<a href="https://github.com/AppleBlox/appleblox">GitHub repo</a>
					and join the
					<a href="https://appleblox.com/discord">Discord Server</a>!
				</p>
				<br />
				<i><h3>⚠️ AppleBlox is in beta, don't expect a bug-free experience</h3></i>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Read later</AlertDialog.Cancel>
			<AlertDialog.Action
				on:click={() => {
					show = false;
					shortcutAndUrl = true;
				}}>Continue</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={shortcutAndUrl}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="dark:text-white text-black">Quick setup</AlertDialog.Title>
			<AlertDialog.Description>
				<p>To unlock the true power of AppleBlox, you can follow these steps.</p>
				<br />
				<p>
					If you want to make AppleBlox work when launching from the website, you can click the "Use Roblox URL" button.
					If you want to disable that later, you can always turn it off inside the "Misc" tab.
				</p>
				<br />
				<p>You should also create a launch shortcut from the button below (also possible in the "Misc" tab)!</p>
				<br />
				<p>
					If you want to use the <strong>Window Movement</strong> feature, we suggest you go into
					<strong>System Settings → Privacy & Security → Accessibility</strong>
					and press the
					<strong>+ icon</strong> to choose and add the AppleBlox app. (Note: Due to a bug, you will need to remove and add
					the app in the permission settings every AppleBlox update)
				</p>
				<br />
				<p>
					🌟 Don't forget to leave a <strong>Star</strong> on the
					<a href="https://github.com/AppleBlox/appleblox">GitHub repo</a>
					and join the
					<a href="https://appleblox.com/discord">Discord Server</a>!
				</p>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer class="flex items-center justify-center">
			<AlertDialog.Cancel>Read later</AlertDialog.Cancel>
			<Button
				on:click={() => {
					Roblox.Utils.createShortcut();
				}}
				variant="secondary"
			>
				Create shortcut
			</Button>
			<Button
				on:click={async () => {
					await setValue('roblox.roblox_launching.delegate_launching', true, true);
					toast.info('Roblox will now open AppleBlox before starting');
				}}
				variant="secondary"
				>Use Roblox URL
			</Button>
			<AlertDialog.Action
				on:click={() => {
					saveSettings('onboarding', { show: false });
					show = false;
					shortcutAndUrl = false;
				}}>Done</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
