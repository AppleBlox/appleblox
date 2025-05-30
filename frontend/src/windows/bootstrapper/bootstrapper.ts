import './bootstrapper.css';
import App from './App.svelte';
import { init, window as win } from '@neutralinojs/lib';

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