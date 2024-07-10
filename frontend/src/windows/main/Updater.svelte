<script lang="ts">
	import { version } from "../../../../package.json";
	import { loadSettings, saveSettings } from "./ts/settings";
	import { compareVersions, curlGet } from "./ts/utils";
	import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { os } from "@neutralinojs/lib";
	import SvelteMarkdown from "svelte-markdown";

	let showUpdatePopup = false;
	let updateVersion = version;
	let body = "";

	async function checkForUpdate() {
		const releases = await curlGet("https://api.github.com/repos/OrigamingWasTaken/appleblox/releases").catch(console.error);
        if (releases.message) return;
		for (const re of releases) {
			if (compareVersions(re.tag_name, updateVersion) > 0) {
				updateVersion = re.tag_name;
				body = re.body;
			}
		}
		if (updateVersion === version) return;
		const compare = compareVersions(updateVersion, version);
		if (compare > 0) {
			console.log(`An update is available: ${updateVersion}`);
			const settings = await loadSettings("updating");
			if (settings) {
				// Last asked date is newer than 7 days
                const timeDiff = Math.round((Date.now() - settings.date) / (1000 * 3600 * 24))
                console.log(timeDiff)
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
			case "x64":
				return "x64";
			case "arm":
				return "arm64";
		}
	}
</script>

<AlertDialog.Root bind:open={showUpdatePopup}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>A new update is available ({updateVersion})</AlertDialog.Title>
			<AlertDialog.Description>
				<SvelteMarkdown source={body.replace(/(\[.*?\])\(https?:\/\/[^\s\)]+\)/g, "$1()")} options={{ gfm: true }} />
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<Button
				variant="secondary"
				on:click={() => {
					saveSettings("updating", { date: Date.now() });
					showUpdatePopup = false;
				}}>Do not ask again</Button
			>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				on:click={() => {
					os.open(`https://github.com/OrigamingWasTaken/appleblox/releases/download/${updateVersion}/AppleBlox-${updateVersion}_${getArch()}.dmg`);
				}}>Install</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
