<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import { events, os } from '@neutralinojs/lib';
	import { ExternalLink, FileCode2 } from 'lucide-svelte';
	import Logger from '@/windows/main/ts/utils/logger';
</script>

<div>
	<Button
		variant="default"
		class="ml-autow"
		on:click={async () => {
			await events.dispatch('ui:change_page', { id: 'flags_editor' }).catch((err) => {
				Logger.error('An error occured while sending event broadcast:', err);
			});
		}}
	>
		<FileCode2 class="h-5 w-5 mr-2" />
		Open Flags editor
	</Button>
	<Button
		on:click={() => {
			os.open('https://github.com/MaximumADHD/Roblox-FFlag-Tracker');
		}}
		variant="outline"
	>
		<ExternalLink class="h-5 w-5 mr-2" />
		About Fast Flags
	</Button>
</div>
