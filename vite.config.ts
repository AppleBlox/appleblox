import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import * as path from 'path';
import {createHtmlPlugin} from 'vite-plugin-html';

const NEU_PORRT = 5174

// https://vitejs.dev/config/
export default defineConfig({
	root: 'frontend',
	plugins: [
		svelte(),
		createHtmlPlugin({
			template: 'index.html',
			inject: {
				data: {
					url: `http://localhost:5174`
				},
			},
		}),
	],
	build: {
		outDir: path.resolve('./frontend/dist'),
		rollupOptions: {
			external: ['/__neutralino_globals.js'],
		},
	},
	resolve: {
		alias: {
			$lib: path.resolve('./frontend/src/lib'),
			'@': path.resolve('./frontend/src'),
			'@root': path.resolve('./'),
		},
	},
	server: {
		host: 'localhost',
	},
});
