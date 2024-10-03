<script lang="ts">
	import { os } from '@neutralinojs/lib';
	import SidebarBtn from './SidebarBtn.svelte';

	export let label: string;
	export let icon: string;
	export let url: string;
</script>

<button
	class="flex items-center justify-center hover:bg-muted rounded-md py-1 px-4 mt-1"
	on:click={() => {
		os.open(url);
	}}
>
	<img src={icon} alt="Linkicon icon" class="w-[17px] towhite mr-2" />
	<p class={'hover:text-primary transition duration-100 font-mono text-[14px]'}>
		{label}
	</p>
</button>
