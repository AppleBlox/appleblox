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
	<AlertDialog.Content class="min-w-[700px]">
		<AlertDialog.Header>
			<AlertDialog.Title class="dark:text-white text-black">Quick setup</AlertDialog.Title>
			<AlertDialog.Description>
				<p>To maximize your experience with AppleBlox, consider the following setup options:</p>
				<br />
				<p>
					For seamless integration with Roblox's website, activate the "Use Roblox URL" feature. This setting can be
					toggled on or off at any time through the "Misc" tab.
				</p>
				<p>
					To streamline your access to AppleBlox, create a launch shortcut using the button below. This option is also
					available in the "Misc" tab for future reference.
				</p>
				<br />
				<p>
					🌟 If you find AppleBlox useful, consider supporting us by:
					<br />• Starring our <a href="https://github.com/AppleBlox/appleblox">GitHub repository</a>
					<br />• Joining our <a href="https://appleblox.com/discord">Discord community</a> for updates and support
				</p>
				<p>Thank you for choosing AppleBlox!</p>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer class="flex items-center justify-center">
			<AlertDialog.Cancel>Read later</AlertDialog.Cancel>
			<Button
				on:click={() => {
					Roblox.Utils.createShortcut();
				}}
				variant="outline"
			>
				Create shortcut
			</Button>
			<Button
				on:click={async () => {
					await setValue('roblox.launching.delegate', true, true);
					toast.info('Roblox will now open AppleBlox before starting');
				}}
				variant="outline"
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
