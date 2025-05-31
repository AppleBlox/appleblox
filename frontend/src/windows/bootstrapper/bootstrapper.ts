import "@/theme.css"
import './bootstrapper.css';
import App from './App.svelte';
import { init } from '@neutralinojs/lib';

try {
    init()
} catch (error) {
    console.error(error)
}

const app = new App({
    // @ts-expect-error
	target: document.getElementById('app'),
});

export default app;