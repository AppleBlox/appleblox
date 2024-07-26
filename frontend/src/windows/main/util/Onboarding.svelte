<script lang="ts">
	import { loadSettings, saveSettings } from '../ts/settings';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { os } from '@neutralinojs/lib';

	let settings = null;
	let show = false;
	loadSettings('onboarding').then((s) => {
		if (s) {
			settings = s;
            if (s.show) {
                show = true
            }
		} else {
            saveSettings("onboarding",{show: true})
            show = true
            console.log(s)
        }
	});
</script>

<AlertDialog.Root bind:open={show}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="dark:text-white text-black">Welcome to AppleBlox</AlertDialog.Title>
			<AlertDialog.Description>
				<p>We are thrilled to have you here! For starters, you should check out the <strong>Integrations & FastFlags </strong>tab.</p>
				<p>If you want to add <strong>Mods</strong>, you should join the AppleBlox or Bloxstrap Discord server from the support/mods tab.</p>
				<br />
				<p>
					🌟 Don't forget to leave a <strong>Star</strong> on the <a href="https://github.com/OrigamingWasTaken/appleblox">GitHub repo</a> and join the
					<a href="https://appleblox.com/discord">Discord Server</a>!
				</p>
				<p>Have fun :D</p>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Read later</AlertDialog.Cancel>
			<AlertDialog.Action
				on:click={() => {
					saveSettings('onboarding', { show: false });
					show = false;
				}}>Continue</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
