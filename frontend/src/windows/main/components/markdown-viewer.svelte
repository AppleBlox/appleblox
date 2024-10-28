<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { os } from '@neutralinojs/lib';
	import { cn } from '$lib/utils';

	export let content: string = '';
	let className: string = '';
	export { className as class };

	function handleLinkClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.tagName === 'A') {
			e.preventDefault();
			e.stopImmediatePropagation()
			const href = target.getAttribute('href');
			if (href) {
				os.open(href);
			}
		}
	}

	$: parsedContent = marked.parse(content, { async: false }) as string;
	$: sanitizedHtml = DOMPurify.sanitize(parsedContent);
</script>

<article
	class={cn('markdown-content prose dark:prose-invert max-w-none prose-headings:text-primary prose-a:text-secondary', className)}
	on:click={handleLinkClick}
	aria-hidden="true"
>
	{@html sanitizedHtml}
</article>

<style lang="postcss">
	:global(.markdown-content blockquote) {
		@apply border-l-4 border-primary pl-4;
	}
</style>
