import '@/theme.css';
import { init } from '@neutralinojs/lib';
import App from './App.svelte';
import './bootstrapper.css';

try {
	init();
} catch (error) {
	console.error(error);
}

const app = new App({
	// @ts-expect-error
	target: document.getElementById('app'),
});

export default app;
