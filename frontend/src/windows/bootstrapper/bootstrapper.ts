import '@/theme.css';
import { init } from '@neutralinojs/lib';
import App from './App.svelte';
import './bootstrapper.css';
import { loadTheme } from '../main/components/theme-input/theme';

try {
	init();
} catch (error) {
	console.error(error);
}

await loadTheme();

const app = new App({
	// @ts-expect-error
	target: document.getElementById('app'),
});

export default app;
