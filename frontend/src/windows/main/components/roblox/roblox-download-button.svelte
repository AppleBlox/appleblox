<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	import { Download } from 'lucide-svelte';
	import RobloxDownloadDialog from './roblox-download-dialog.svelte';

	let open = false;
</script>

<div class="mt-[8px]">
	<Tooltip.Root>
		<Tooltip.Trigger>
			<Button
				on:click={() => {
					open = true;
				}}
			>
				<Download class="w-5 h-5 mr-2" />
				<p>Install Roblox</p>
			</Button>
		</Tooltip.Trigger>
		<Tooltip.Content>Install Roblox directly from the Roblox API</Tooltip.Content>
	</Tooltip.Root>
</div>

<RobloxDownloadDialog bind:open />
