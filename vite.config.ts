import { svelte } from '@sveltejs/vite-plugin-svelte';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import neutralino from './scripts/package/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
	root: path.resolve("./frontend"),
	// publicDir: path.resolve("./frontend/public"),
	plugins: [svelte(), checker({ typescript: true }), neutralino()],
	build: {
		outDir: path.resolve('./frontend/dist'),
		rollupOptions: {
			external: ['/__neutralino_globals.js'],
			input: {
				main: path.resolve("frontend", "index.html"),
				bootstraper: path.resolve("frontend", "bootstrapper.html")
			}
		},
		sourcemap: true,
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
	assetsInclude: ['**/*.icns'],
});
