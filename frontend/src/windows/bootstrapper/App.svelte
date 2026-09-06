<script lang="ts">
	import Logo from '@/assets/appleblox.svg';
	import { Progress } from '@/lib/components/ui/progress';
	import { filesystem, events, init as neuInit, server } from '@neutralinojs/lib';
	import { ModeWatcher, setMode } from 'mode-watcher';
	import { onMount } from 'svelte';
	import Logger from '@/windows/main/ts/utils/logger';
	import { getDataDir } from '@/windows/main/ts/utils/paths';
	import path from 'path-browserify';
	import { parseBootstrapperTheme, type ParsedTheme } from './wpfui-theme';
	import ThemeElement from './components/ThemeElement.svelte';

	let progress = 0;
	let text = 'Initializing...';
	let theme: ParsedTheme | null = null;
	let assetsDir = '';

	const params = new URLSearchParams(window.location.search);

	// Inject Neutralino auth globals from URL params so neuInit() can connect to the
	// Neutralino WebSocket even when running inside transparent_viewer (no injectGlobals).
	const nlTokenParam = params.get('nl_token');
	const nlPortParam = params.get('nl_port');
	if (nlTokenParam && nlPortParam) {
		const nlPortNum = parseInt(nlPortParam, 10);
		if (!isNaN(nlPortNum)) {
			(window as any).NL_TOKEN = nlTokenParam;
			(window as any).NL_PORT = nlPortNum;
		}
	}

	// Scale factor passed by launch.ts so the themed window fills the Mac screen proportionally
	// to how it would appear on the 1920×1080 Windows reference used by Bloxstrap theme authors.
	const contentScale = Math.max(0.1, Math.min(2, parseFloat(params.get('scale') ?? '1') || 1));

	setMode('system');

	/** Convert a theme:// URL to an HTTP URL served via Neutralino's server.mount.
	 * Must use NL_PORT (the main backend's port) because server.mount is registered
	 * on the main backend, regardless of what port the webview loaded from (e.g. Vite in dev). */
	function resolveThemeUrl(themeUrl: string): string {
		return `http://localhost:${window.NL_PORT}/bootstrapper-assets/${themeUrl.replace('theme://', '')}`;
	}

	/** Inject @font-face CSS rules for all theme fonts so they can be used by name. */
	function injectThemeFonts(fonts: ParsedTheme['fonts']) {
		if (fonts.length === 0) return;
		const css = fonts
			.map((f) => `@font-face { font-family: '${f.family}'; src: url('${resolveThemeUrl(f.themeUrl)}'); }`)
			.join('\n');
		const style = document.createElement('style');
		style.textContent = css;
		document.head.appendChild(style);
	}

	onMount(async () => {
		// Load theme from URL param first (base64url-encoded JSON, set by launch.ts).
		// This path works in transparent_viewer where Neutralino filesystem APIs are unavailable.
		const themeParam = params.get('theme');
		if (themeParam) {
			try {
				const b64 = themeParam.replace(/-/g, '+').replace(/_/g, '/');
				const json = decodeURIComponent(escape(atob(b64)));
				const parsed = JSON.parse(json) as ParsedTheme;
				theme = parsed;
				setMode(parsed.mode);
				injectThemeFonts(parsed.fonts);
				Logger.info('Bootstrapper: Loaded theme from URL param.');
			} catch (e) {
				Logger.error('Bootstrapper: Failed to decode theme from URL param:', e);
			}
		}

		try {
			neuInit();
		} catch (e) {
			Logger.error('Bootstrapper: Neutralino init failed:', e);
			return;
		}

		events.on('bootstrapper:progress', (evt: CustomEvent) => {
			if (evt && evt.detail && typeof evt.detail.progress === 'number') {
				progress = evt.detail.progress;
			}
		});
		events.on('bootstrapper:text', (evt: CustomEvent) => {
			if (evt && evt.detail && typeof evt.detail.text === 'string') {
				text = evt.detail.text;
			}
		});

		try {
			await events.broadcast('bootstrapper:ready', { windowId: window.NL_PID });
			Logger.info('Bootstrapper: Broadcasted ready event.');
		} catch (e) {
			Logger.error('Bootstrapper: Failed to broadcast bootstrapper:ready', e);
		}

		// Fallback: load theme from filesystem when no URL param was provided
		// (e.g. dev mode direct open or future Neutralino window path).
		if (!themeParam) {
			try {
				const dataDir = await getDataDir();
				const themePath = path.join(dataDir, 'bootstrapper-theme.xml');
				assetsDir = path.join(dataDir, 'bootstrapper-theme-assets');

				const xml = await filesystem.readFile(themePath);
				const parsed = parseBootstrapperTheme(xml);
				if (parsed) {
					try {
						const dirStats = await filesystem.getStats(assetsDir);
						if (dirStats.isDirectory) {
							await server.mount('/bootstrapper-assets/', assetsDir);
						}
					} catch {
						// assetsDir doesn't exist or already mounted — skip
					}
					theme = parsed;
					setMode(parsed.mode);
					injectThemeFonts(parsed.fonts);
					Logger.info('Bootstrapper: Loaded custom theme from filesystem.');
				}
			} catch {
				// No theme file or parse error — use the default UI
			}
		}
	});

	function stretchToCss(stretch: string): string {
		if (stretch === 'Fill') return '100% 100%';
		if (stretch === 'Uniform') return 'contain';
		if (stretch === 'UniformToFill') return 'cover';
		return 'auto';
	}

	/** Build CSS background properties for a theme ImageBrush. */
	function buildBgImageStyle(bg: NonNullable<typeof theme>['backgroundImage']): string {
		if (!bg) return '';
		// Resolve URL: {Icon} → AppleBlox logo, theme:// → served asset
		const url = bg.url === '{Icon}' ? Logo : resolveThemeUrl(bg.url);
		const parts: string[] = [`background-image: url('${url}')`];

		if (bg.tileMode && bg.tileMode !== 'None') {
			parts.push('background-repeat: repeat');
			// Viewport with absolute units gives the tile size
			if (bg.viewport && bg.viewportUnits === 'Absolute') {
				const vp = bg.viewport.split(',').map(Number);
				if (vp.length === 4) {
					const w = vp[2] - vp[0];
					const h = vp[3] - vp[1];
					parts.push(`background-size: ${w}px ${h}px`);
				}
			} else {
				parts.push(`background-size: ${stretchToCss(bg.stretch)}`);
			}
			parts.push('background-position: 0 0');
		} else {
			parts.push('background-repeat: no-repeat');
			parts.push(`background-size: ${stretchToCss(bg.stretch)}`);
			parts.push('background-position: center');
		}
		return parts.join('; ');
	}
</script>

<ModeWatcher />

{#if theme}
	<!-- Themed bootstrapper (fishstrap/WPFui-compatible) -->
	<!-- Outer div holds the exact scaled pixel dimensions so the window is filled.
	     Inner div is the natural theme size, scaled via transform so that all child
	     coordinates (including position:absolute and width:100%) always resolve in
	     the original theme coordinate space — avoiding zoom percentage quirks. -->
	<div
		class="select-none"
		style="width: {Math.round(theme.width * contentScale)}px; height: {Math.round(theme.height * contentScale)}px; position: relative; border-radius: 10px; overflow: hidden;"
	>
		<div
			style="width: {theme.width}px; height: {theme.height}px; position: absolute; top: 0; left: 0; overflow: hidden; transform-origin: top left; transform: scale({contentScale}); background: {theme.background ?? 'var(--wpf-app-bg)'};{theme.backgroundImage
				? ` ${buildBgImageStyle(theme.backgroundImage)};`
				: ''}{theme.containerPadding ? ` padding: ${theme.containerPadding};` : ''}{theme.cornerRadius
				? ` border-radius: ${theme.cornerRadius}px;`
				: ''}"
		>
		{#each theme.elements as el, i (el.name ?? i)}
			<ThemeElement {el} {text} {progress} {resolveThemeUrl} />
		{/each}
		</div>
	</div>

{:else}
	<!-- Default AppleBlox bootstrapper UI -->
	<div class="flex flex-col items-center justify-center h-screen w-screen transition-opacity duration-500 ease-in-out select-none">
		<div class="relative z-10 text-center w-full h-full flex flex-col items-center justify-center px-[8vw] py-[6vh]">
			<img src={Logo} alt="AppleBlox Logo" class="w-[28vmin] h-[28vmin] mx-auto mb-[4vh] object-contain" id="launch_logo" />

			<h1 class="text-[5vmin] font-semibold mb-[4vh] text-foreground leading-tight tracking-wide max-w-full" id="launch_text">
				{text}
			</h1>

			<div class="mb-[3vh] w-full">
				<Progress
					value={progress}
					max={100}
					class="w-full h-[2vmin] min-h-[12px] max-h-[24px] [&>div]:bg-primary [&>div]:transition-all [&>div]:duration-300"
					id="launch_progress"
				/>
			</div>

			<p class="text-[3vmin] text-foreground/70 font-medium tracking-wider mb-[2vh]">AppleBlox Bootstrapper</p>

			<p class="text-[2.5vmin] text-foreground/50 font-mono">
				{Math.round(progress)}%
			</p>
		</div>
	</div>
{/if}

<style>
	/* WPFui theme resource brush CSS variables.
	   :root = light mode (mode-watcher default), :root.dark = dark mode. */
	:root {
		--wpf-text-primary: rgba(0, 0, 0, 0.894);
		--wpf-text-secondary: rgba(0, 0, 0, 0.616);
		--wpf-text-tertiary: rgba(0, 0, 0, 0.447);
		--wpf-text-disabled: rgba(0, 0, 0, 0.361);
		--wpf-app-bg: #fafafa;
		--wpf-control-fill: rgba(255, 255, 255, 0.7);
	}
	:root.dark {
		--wpf-text-primary: #ffffff;
		--wpf-text-secondary: rgba(255, 255, 255, 0.773);
		--wpf-text-tertiary: rgba(255, 255, 255, 0.529);
		--wpf-text-disabled: rgba(255, 255, 255, 0.365);
		--wpf-app-bg: #202020;
		--wpf-control-fill: rgba(255, 255, 255, 0.059);
	}
</style>
