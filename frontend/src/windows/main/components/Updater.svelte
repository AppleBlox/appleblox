<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { os } from '@neutralinojs/lib';
	import compare from 'semver-compare';
	import { toast } from 'svelte-sonner';
	import { version } from '../../../../../package.json';
	import { shell } from '../ts/tools/shell';
	import { curlGet } from '../ts/utils';
	import { loadSettings, saveSettings } from './settings';
	import MarkdownViewer from './markdown-viewer.svelte';

	let showUpdatePopup = false;
	let updateVersion = version;
	let body = '';

	async function checkForUpdate() {
		const checkWifi = await shell(`if ping -c 1 -W 1 8.8.8.8 &> /dev/null; then echo "true"; else echo "false"; fi`, [], {
			completeCommand: true,
		});
		if (!checkWifi.stdOut.includes('true')) {
			toast.error('Could not connect to internet');
			return;
		}
		const releases = await curlGet('https://api.github.com/repos/AppleBlox/appleblox/releases').catch((err) => {
			console.error('[Updater] ', err);
			return;
		});
		if (releases.message) return;
		for (const re of releases) {
			if (compare(re.tag_name, updateVersion) === 1) {
				updateVersion = re.tag_name;
				body = re.body;
			}
		}
		if (updateVersion === version) return;
		if (compare(updateVersion, version) === 1) {
			console.info(`[Updater] A new release is available: ${updateVersion}`);
			const settings = await loadSettings('updating');
			if (settings) {
				// Last asked date is newer than 7 days
				const timeDiff = Math.round((Date.now() - settings.date) / (1000 * 3600 * 24));
				if (timeDiff <= 7) return;
				showUpdatePopup = true;
			} else {
				showUpdatePopup = true;
			}
		}
	}
	checkForUpdate();

	function getArch() {
		switch (window.NL_ARCH as unknown as string) {
			case 'x64':
				return 'x64';
			case 'arm':
				return 'arm64';
		}
	}
</script>

<AlertDialog.Root bind:open={showUpdatePopup} closeOnOutsideClick={true} closeOnEscape={true}>
	<AlertDialog.Content class="max-h-[90vh] max-w-[90vw] overflow-scroll">
		<AlertDialog.Header>
			<AlertDialog.Description class="text-foreground mt-0">
				<p class="text-card-foreground mb-3">A new release is available (v{updateVersion})</p>
				<MarkdownViewer content={body}/>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<Button
				variant="secondary"
				on:click={() => {
					saveSettings('updating', { date: Date.now() });
					showUpdatePopup = false;
				}}>Do not ask again</Button
			>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				on:click={() => {
					os.open(
						`https://github.com/AppleBlox/appleblox/releases/download/${updateVersion}/AppleBlox-${updateVersion}_${getArch()}.dmg`
					);
				}}>Install</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
