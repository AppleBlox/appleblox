/// <reference types="svelte" />
/// <reference types="vite/client" />
declare module '*.svelte';
declare module '*.icns' {
	const src: string;
	export default src;
}
declare module '*.png' {
	const src: string;
	export default src;
}