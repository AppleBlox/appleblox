import type { Plugin, ResolvedConfig } from 'vite';
// @ts-ignore
import buildConfig from '../../build.config';
const { devPort } = buildConfig;

export default (): Plugin => {
	let config: ResolvedConfig;

	return {
		name: 'neutralino',

		configResolved(resolvedConfig) {
			config = resolvedConfig;
		},

		async transformIndexHtml(html) {
			if (config.mode === 'production') {
				return html.replace(/<%- url %>/g, '%PUBLIC_URL%');
			}

			if (config.mode === 'development') {
				return html.replace(/<%- url %>/g, `http://localhost:${devPort}`);
			}

			return html;
		},
	};
};
