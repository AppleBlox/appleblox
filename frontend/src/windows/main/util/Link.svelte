<script>
	import { os } from '@neutralinojs/lib';

	export let href = '';
	export let title = undefined;
</script>

<a
	href="_blank"
	on:click={(e) => {
        e.preventDefault()
		os.open(href);
	}}
	{title}><slot></slot></a
>
