<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { os } from '@neutralinojs/lib';
	import type { Contributor } from './types';
	import Logger from '@/windows/main/ts/utils/logger';

	export let contributors: Contributor[];

	function getRoleColor(role?: string): string {
		if (!role) return 'default';

		const roleColors: Record<string, string> = {
			'Developer': 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
			'Artist': 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
			'Moderator': 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
			'Tester': 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
			'Framework': 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30',
			'Language': 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
			'Icons': 'bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30',
			'Inspiration': 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30',
		};

		return roleColors[role] || 'bg-secondary/20 text-secondary-foreground border-secondary/30';
	}

	function getCardTint(role?: string): string {
		if (!role) return '';

		const tints: Record<string, string> = {
			'Developer': 'card-tint-blue',
			'Artist': 'card-tint-purple',
			'Moderator': 'card-tint-green',
			'Tester': 'card-tint-yellow',
			'Framework': 'card-tint-orange',
			'Language': 'card-tint-cyan',
			'Icons': 'card-tint-pink',
			'Inspiration': 'card-tint-rose',
		};

		return tints[role] || '';
	}

	function shouldContainImage(role?: string): boolean {
		// Technologies and Inspirations should contain their images to prevent overflow
		return role === 'Framework' || role === 'Language' || role === 'Icons' || role === 'Inspiration';
	}

	function handleMouseMove(event: MouseEvent) {
		const card = event.currentTarget as HTMLElement;
		const rect = card.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const centerX = rect.width / 2;
		const centerY = rect.height / 2;

		const rotateX = ((y - centerY) / centerY) * -10;
		const rotateY = ((x - centerX) / centerX) * 10;

		card.style.setProperty('--rotate-x', `${rotateX}deg`);
		card.style.setProperty('--rotate-y', `${rotateY}deg`);
	}

	function handleMouseLeave(event: MouseEvent) {
		const card = event.currentTarget as HTMLElement;
		card.style.setProperty('--rotate-x', '0deg');
		card.style.setProperty('--rotate-y', '0deg');
	}

	function handleClick(contributor: Contributor) {
		if (!contributor.link) return;
		os.open(contributor.link).catch(Logger.error);
	}

	function handleKeyDown(event: KeyboardEvent, contributor: Contributor) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick(contributor);
		}
	}
</script>

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full p-2">
	{#each contributors as contributor (contributor.name)}
		<div
			class="contributor-card {contributor.link ? 'cursor-pointer' : 'cursor-default'}"
			on:click={() => handleClick(contributor)}
			on:keydown={(e) => handleKeyDown(e, contributor)}
			on:mousemove={handleMouseMove}
			on:mouseleave={handleMouseLeave}
			role="button"
			tabindex="0"
		>
			<Card.Root class="card-wrapper h-full border overflow-hidden {getCardTint(contributor.role)}">
				<div class="card-tint-overlay"></div>
				<Card.Content class="p-0 h-full flex flex-col relative z-10">
					<!-- Avatar Section -->
					<div class="aspect-square w-full overflow-hidden bg-muted/30 relative">
						<img
							src={contributor.avatar}
							alt={`@${contributor.name}`}
							class="w-full h-full {shouldContainImage(contributor.role) ? 'object-contain p-4' : 'object-cover'}"
						/>
						{#if contributor.role}
							<div class="absolute top-2 right-2">
								<Badge class="badge-with-backdrop text-xs font-semibold shadow-lg border {getRoleColor(contributor.role)}">
									{contributor.role}
								</Badge>
							</div>
						{/if}
					</div>

					<!-- Info Section -->
					<div class="p-4 flex-1 flex flex-col justify-center">
						<h3 class="font-bold text-foreground text-base mb-1 truncate">{contributor.name}</h3>
						<p class="text-xs text-muted-foreground line-clamp-2">{contributor.description}</p>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	{/each}
</div>

<style>
	.contributor-card {
		--rotate-x: 0deg;
		--rotate-y: 0deg;
		transition: transform 0.2s ease-out;
		transform: perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y));
	}

	.contributor-card:hover {
		transform: perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y)) scale(1.05);
	}

	.contributor-card :global(.card-wrapper) {
		background: hsl(var(--card));
		border-radius: 1rem;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		transition: box-shadow 0.3s ease;
		position: relative;
		isolation: isolate;
		overflow: hidden;
	}

	.contributor-card:hover :global(.card-wrapper) {
		box-shadow:
			0 20px 40px -5px rgba(0, 0, 0, 0.4),
			0 10px 25px -3px rgba(0, 0, 0, 0.3);
	}

	.contributor-card:focus-visible {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
		border-radius: 1rem;
	}

	/* Card tint overlay - positioned absolutely to cover entire card */
	.contributor-card :global(.card-tint-overlay) {
		position: absolute;
		inset: 0;
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
		z-index: 1;
		border-radius: 1rem;
		will-change: opacity;
	}

	.contributor-card:hover :global(.card-tint-overlay) {
		opacity: 1;
	}

	/* Role-based tint colors */
	:global(.card-tint-blue .card-tint-overlay) {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%);
	}

	:global(.card-tint-purple .card-tint-overlay) {
		background: linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%);
	}

	:global(.card-tint-green .card-tint-overlay) {
		background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%);
	}

	:global(.card-tint-yellow .card-tint-overlay) {
		background: linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(234, 179, 8, 0.05) 100%);
	}

	:global(.card-tint-orange .card-tint-overlay) {
		background: linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(249, 115, 22, 0.05) 100%);
	}

	:global(.card-tint-cyan .card-tint-overlay) {
		background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%);
	}

	:global(.card-tint-pink .card-tint-overlay) {
		background: linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0.05) 100%);
	}

	:global(.card-tint-rose .card-tint-overlay) {
		background: linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(244, 63, 94, 0.05) 100%);
	}

	/* Badge backdrop blur for better text readability */
	:global(.badge-with-backdrop) {
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		background-color: rgba(0, 0, 0, 0.6) !important;
	}

	:global(.badge-with-backdrop::before) {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: inherit;
		z-index: -1;
	}
</style>
