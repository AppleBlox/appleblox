<script lang="ts">
	import ContributorsCollection from './contributors-collection.svelte';
	import type { Contributor } from './types';

	const contributors: Contributor[] = [
		// Developers
		{
			name: 'OrigamingWasTaken',
			description: 'Maintainer & main developer',
			avatar: 'https://avatars.githubusercontent.com/u/74014262?v=4',
			link: 'https://github.com/OrigamingWasTaken',
			role: 'Developer',
		},
		// Testers & Moderators
		{
			name: 'Satalights',
			description: 'Moderator & Tester',
			avatar: 'https://avatars.githubusercontent.com/u/98926761?v=4',
			link: 'https://github.com/SoiKr',
			role: 'Moderator',
		},
		{
			name: 'allFiction',
			description: 'Moderator & tester',
			avatar: 'https://avatars.githubusercontent.com/u/143362759?v=4',
			link: 'https://github.com/AngrySausage',
			role: 'Moderator',
		},
		{
			name: 'TrisecTroop',
			description: 'Moderator & tester',
			avatar: 'https://avatars.githubusercontent.com/u/126478355?v=4',
			link: 'https://github.com/TrisecTroop',
			role: 'Moderator',
		},
		{
			name: 'n.u.g',
			description: 'Moderator & tester',
			avatar: 'https://i.imgur.com/3UDfZGJ.png',
			link: 'https://github.com/TrisecTroop',
			role: 'Moderator',
		},
		{
			name: 'atomic',
			description: 'Tester & ori yap support',
			avatar: 'https://avatars.githubusercontent.com/u/146490689?v=4',
			link: 'https://github.com/20ch',
			role: 'Tester',
		},
		// Artists
		{
			name: 'BakaTheSussy',
			description: 'Designer of the liquid glass icons',
			avatar: 'https://i.imgur.com/B9CzoKX.png',
			link: null,
			role: 'Artist',
		},
		{
			name: 'typeofnull',
			description: 'Deisgner of the main AppleBlox logo',
			avatar: 'https://i.imgur.com/caBlXK5.png',
			link: null,
			role: 'Artist',
		},
		{
			name: 'abyzal.',
			description: 'Designer of the first AppleBlox logo',
			avatar: 'https://avatars.githubusercontent.com/u/157009854?v=4',
			link: 'https://github.com/PurvisiLOL',
			role: 'Artist',
		},
		// Technologies
		{
			name: 'NeutralinoJS',
			description: 'Lightweight C++ and cross-platform framework for making desktop apps',
			avatar: 'https://raw.githubusercontent.com/neutralinojs/design-guide/d3a8fc284d9fff591b173d3bf53998ee0424aeea/logo/neutralinojs_logo_vector.svg',
			link: 'https://neutralino.js.org',
			role: 'Framework',
		},
		{
			name: 'Svelte',
			description: 'Free and open-source component-based front-end software framework',
			avatar: 'https://github.com/sveltejs/branding/blob/master/svelte-logo.png?raw=true',
			link: 'https://svelte.dev',
			role: 'Framework',
		},
		{
			name: 'TypeScript',
			description: 'Superset of JavaScript with static types that compiles to clean JavaScript output',
			avatar: 'https://www.typescriptlang.org/images/branding/logo-grouping.svg',
			link: 'https://www.typescriptlang.org/',
			role: 'Language',
		},
		{
			name: 'Icons8',
			description: 'Library of high quality free icons',
			avatar: 'https://s3-eu-west-1.amazonaws.com/tpd/logos/59ca1db50000ff0005ac11cf/0x0.png',
			link: 'https://icons8.com/',
			role: 'Icons',
		},
		// Inspirations
		{
			name: 'Bloxstrap',
			description: 'An alternative replacement for the standard Roblox launcher, main inspiration for this app.',
			avatar: 'https://github.com/bloxstraplabs/bloxstrap/blob/main/Images/Bloxstrap.png?raw=true',
			link: 'https://github.com/bloxstraplabs/bloxstrap',
			role: 'Inspiration',
		},
	];
</script>

<div class="w-full">
	<ContributorsCollection {contributors} />
</div>
