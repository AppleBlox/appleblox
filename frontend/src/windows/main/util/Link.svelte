<script>
import { os } from '@neutralinojs/lib';

export const href = '';
export const title = undefined;
</script>

<a
	href="_blank"
	on:click={(e) => {
        e.preventDefault()
		os.open(href);
	}}
	{title}><slot></slot></a
>
