<script lang="ts">
	import Accordion from './accordion.svelte';
	import ContributorsCollection from './contributors-collection.svelte';
	import type { Contributor, Technology } from './types';

	const developers: Contributor[] = [
		{
			name: 'OrigamingWasTaken',
			description: 'Maintainer & main developer',
			avatar: 'https://avatars.githubusercontent.com/u/74014262?v=4',
			link: 'https://github.com/OrigamingWasTaken',
		},
	];
	const artists: Contributor[] = [
		{ name: 'typeofnull', description: 'Maker of the current AppleBlox logo', avatar: 'https://i.imgur.com/caBlXK5.png', link: null },
		{
			name: 'abyzal.',
			description: 'Maker of the first AppleBlox logo',
			avatar: 'https://avatars.githubusercontent.com/u/157009854?v=4',
			link: 'https://github.com/PurvisiLOL',
		},
	];
	const testers: Contributor[] = [
		{
			name: 'allFiction',
			description: 'Moderator & tester',
			avatar: 'https://avatars.githubusercontent.com/u/143362759?v=4',
			link: 'https://github.com/AngrySausage',
		},
		{
			name: 'TrisecTroop',
			description: 'Moderator & tester',
			avatar: 'https://avatars.githubusercontent.com/u/126478355?v=4',
			link: 'https://github.com/TrisecTroop',
		},
		{
			name: 'n.u.g',
			description: 'Moderator & tester',
			avatar: 'https://i.imgur.com/3UDfZGJ.png',
			link: 'https://github.com/TrisecTroop',
		},
		{
			name: 'atomic',
			description: 'Tester & ori yap support',
			avatar: 'https://avatars.githubusercontent.com/u/146490689?v=4',
			link: 'https://github.com/20ch',
		},
	];

	const technologies: Technology[] = [
		{
			name: 'NeutralinoJS',
			description: 'Lightweight C++ and cross-platform framework for making desktop apps',
			avatar: 'https://raw.githubusercontent.com/neutralinojs/design-guide/d3a8fc284d9fff591b173d3bf53998ee0424aeea/logo/neutralinojs_logo_vector.svg',
			link: 'https://neutralino.js.org',
		},
		{
			name: 'Svelte',
			description: 'Free and open-source component-based front-end software framework',
			avatar: 'https://github.com/sveltejs/branding/blob/master/svelte-logo.png?raw=true',
			link: 'https://svelte.dev',
		},
		{
			name: 'TypeScript',
			description: 'Superset of JavaScript with static types that compiles to clean JavaScript output',
			avatar: 'https://www.typescriptlang.org/images/branding/logo-grouping.svg',
			link: 'https://www.typescriptlang.org/',
		},
		{
			name: 'Icons8',
			description: 'Library of high quality free icons',
			avatar: 'https://s3-eu-west-1.amazonaws.com/tpd/logos/59ca1db50000ff0005ac11cf/0x0.png',
			link: 'https://icons8.com/',
		},
	];

	const inspirations: Contributor[] = [
		{
			name: 'Bloxstrap',
			description: 'An alternative replacement for the standard Roblox launcher, main inspiration for this app.',
			avatar: 'https://github.com/bloxstraplabs/bloxstrap/blob/main/Images/Bloxstrap.png?raw=true',
			link: 'https://github.com/bloxstraplabs/bloxstrap',
		},
	];
</script>

<div class="flex flex-col gap-2 w-full">
	<h2 class="font-extralight text-xl text-rose-500/80">Developers</h2>
	<ContributorsCollection contributors={developers} />
	<h2 class="font-serif tracking-widest text-xl text-rose-400/80">Artists</h2>
	<ContributorsCollection contributors={artists} />
	<Accordion contributors={testers} label="Testers" class="font-mono text-xl text-rose-300/80" />
	<Accordion contributors={inspirations} label="Inspirations" class="font-mono text-xl text-rose-200/80" />
	<Accordion contributors={technologies} label="Technologies" class="font-mono text-xl text-rose-100/80" />
</div>
