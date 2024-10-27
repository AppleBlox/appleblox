<script lang="ts">
	import type { Contributor } from './types';
	import * as Card from '$lib/components/ui/card';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { AspectRatio } from '$lib/components/ui/aspect-ratio';
	import { os } from '@neutralinojs/lib';

	export let contributors: Contributor[];
</script>

<div>
	{#each contributors as contributor (contributor.name)}
		<button
			class={contributor.link ? 'cursor-pointer' : 'cursor-default'}
			on:click={() => {
				if (!contributor.link) return;
				os.open(contributor.link).catch(console.error);
			}}
		>
			<Card.Root class="rounded-sm hover:brightness-110 transition-all mr-4 mb-4">
				<Card.Header class="flex flex-row gap-4 items-center">
					<Avatar.Root class="w-10 h-10">
						<AspectRatio ratio={1} class="max-w-full max-h-full overflow-hidden">
							<Avatar.Image
								src={contributor.avatar}
								alt={`@${contributor.name}`}
								class="w-full h-full object-contain"
							/>
							<Avatar.Fallback><Skeleton /></Avatar.Fallback>
						</AspectRatio>
					</Avatar.Root>
					<div>
						<Card.Title class="text-foreground/90 text-start">{contributor.name}</Card.Title>
						<Card.Description class="text-foreground/70 text-start">{contributor.description}</Card.Description>
					</div>
				</Card.Header>
			</Card.Root>
		</button>
	{/each}
</div>
