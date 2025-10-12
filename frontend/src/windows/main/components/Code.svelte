<script>
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { clipboard } from '@neutralinojs/lib';
	import { ClipboardCopy } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import Logger from '@/windows/main/ts/utils/logger';

	export let code = '';
	let className = '';
	export { className as class };
</script>

<div class={cn(className, 'relative bg-card rounded-md p-4 mb-4')}>
	<Button
		variant="outline"
		size="icon"
		class="fixed top-13 right-11 z-10"
		on:click={() => {
			toast.info('Copied to clipboard!', { duration: 1000 });
			clipboard.writeText(code).catch((err) => {
				Logger.error('Failed to write to clipboard:', err);
			});
		}}
	>
		<ClipboardCopy class="h-4 w-4" />
	</Button>
	<code class="font-mono text-sm overflow-x-auto text-card-foreground p-1">
		<p class="brightness-75">
			{code}
		</p>
	</code>
</div>
