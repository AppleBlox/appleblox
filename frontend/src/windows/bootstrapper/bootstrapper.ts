import '@/theme.css';
import { init } from '@neutralinojs/lib';
import { loadTheme } from '../main/components/theme-input/theme';
import App from './App.svelte';
import './bootstrapper.css';
import Logger from '@/windows/main/ts/utils/logger';

try {
	init();
} catch (error) {
	Logger.error(error);
}

loadTheme().catch(Logger.error);

const app = new App({
	// @ts-expect-error
	target: document.getElementById('app'),
});

export default app;
