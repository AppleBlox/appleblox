<script lang="ts">
	import { os } from "@neutralinojs/lib";

	export let label: string;
	export let icon: string;
	export let url: string;
	</script>
	
	<button
		class="flex items-center justify-center mb-2"
		on:click={() => {
			os.open(url)
		}}>
		<img src={icon} alt="Linkicon icon" class="w-[15px] towhite mr-1" />
		<p class={'text-black hover:opacity-50 dark:text-gray-300 dark:hover:text-gray-50 transition duration-100 font-mono text-[14px]'}>{label}</p>
	</button>