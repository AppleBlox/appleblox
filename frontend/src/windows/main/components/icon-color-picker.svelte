<script lang="ts">
	import { Loader2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { onMount, tick } from 'svelte';
	import { getValue, setValue } from './settings';
	import { generateIconColorCache, hexToRgb } from '../ts/roblox/font-colorizer';
	import Logger from '@/windows/main/ts/utils/logger';

	const logger = Logger.withContext('IconColorPicker');

	let hex = '#FFFFFF';
	let isGenerating = false;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let initialized = false;

	// HSV values for the picker
	let hue = 0;
	let saturation = 0;
	let brightness = 100;

	// Canvas refs
	let satBrightCanvas: HTMLCanvasElement;
	let hueCanvas: HTMLCanvasElement;
	let isDraggingSatBright = false;
	let isDraggingHue = false;

	onMount(async () => {
		// Load saved color first
		try {
			const savedColor = await getValue<string | null>('mods.builtin.icon_color');
			if (savedColor && /^#[0-9A-Fa-f]{6}$/.test(savedColor)) {
				hex = savedColor;
				const hsv = hexToHsv(savedColor);
				hue = hsv.h;
				saturation = hsv.s;
				brightness = hsv.v;
			}
		} catch {
			// Setting doesn't exist yet
		}

		// Wait for DOM to update with canvas refs
		await tick();

		// Draw canvases with loaded values
		drawHueSlider();
		drawSatBrightPicker();

		initialized = true;
	});

	function hexToHsv(hex: string): { h: number; s: number; v: number } {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;

		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const d = max - min;

		let h = 0;
		const s = max === 0 ? 0 : (d / max) * 100;
		const v = max * 100;

		if (d !== 0) {
			switch (max) {
				case r:
					h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
					break;
				case g:
					h = ((b - r) / d + 2) * 60;
					break;
				case b:
					h = ((r - g) / d + 4) * 60;
					break;
			}
		}

		return { h, s, v };
	}

	function hsvToHex(h: number, s: number, v: number): string {
		s = s / 100;
		v = v / 100;

		const c = v * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = v - c;

		let r = 0,
			g = 0,
			b = 0;

		if (h < 60) {
			r = c;
			g = x;
		} else if (h < 120) {
			r = x;
			g = c;
		} else if (h < 180) {
			g = c;
			b = x;
		} else if (h < 240) {
			g = x;
			b = c;
		} else if (h < 300) {
			r = x;
			b = c;
		} else {
			r = c;
			b = x;
		}

		const toHex = (n: number) =>
			Math.round((n + m) * 255)
				.toString(16)
				.padStart(2, '0');
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
	}

	function drawHueSlider() {
		if (!hueCanvas) return;
		const ctx = hueCanvas.getContext('2d')!;
		const width = hueCanvas.width;
		const height = hueCanvas.height;

		const gradient = ctx.createLinearGradient(0, 0, width, 0);
		gradient.addColorStop(0, '#FF0000');
		gradient.addColorStop(0.17, '#FFFF00');
		gradient.addColorStop(0.33, '#00FF00');
		gradient.addColorStop(0.5, '#00FFFF');
		gradient.addColorStop(0.67, '#0000FF');
		gradient.addColorStop(0.83, '#FF00FF');
		gradient.addColorStop(1, '#FF0000');

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);
	}

	function drawSatBrightPicker() {
		if (!satBrightCanvas) return;
		const ctx = satBrightCanvas.getContext('2d')!;
		const width = satBrightCanvas.width;
		const height = satBrightCanvas.height;

		// Base color from hue
		const baseColor = hsvToHex(hue, 100, 100);

		// White to color gradient (horizontal)
		const gradientH = ctx.createLinearGradient(0, 0, width, 0);
		gradientH.addColorStop(0, '#FFFFFF');
		gradientH.addColorStop(1, baseColor);
		ctx.fillStyle = gradientH;
		ctx.fillRect(0, 0, width, height);

		// Black gradient overlay (vertical)
		const gradientV = ctx.createLinearGradient(0, 0, 0, height);
		gradientV.addColorStop(0, 'rgba(0,0,0,0)');
		gradientV.addColorStop(1, 'rgba(0,0,0,1)');
		ctx.fillStyle = gradientV;
		ctx.fillRect(0, 0, width, height);
	}

	function updateColorFromHsv() {
		hex = hsvToHex(hue, saturation, brightness);
		onUserInteraction();
	}

	function handleSatBrightMouseDown(e: MouseEvent) {
		isDraggingSatBright = true;
		handleSatBrightMove(e);
	}

	function handleSatBrightMove(e: MouseEvent) {
		if (!isDraggingSatBright || !satBrightCanvas) return;
		const rect = satBrightCanvas.getBoundingClientRect();
		const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
		const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

		saturation = (x / rect.width) * 100;
		brightness = 100 - (y / rect.height) * 100;
		updateColorFromHsv();
	}

	function handleHueMouseDown(e: MouseEvent) {
		isDraggingHue = true;
		handleHueMove(e);
	}

	function handleHueMove(e: MouseEvent) {
		if (!isDraggingHue || !hueCanvas) return;
		const rect = hueCanvas.getBoundingClientRect();
		const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));

		hue = (x / rect.width) * 360;
		drawSatBrightPicker();
		updateColorFromHsv();
	}

	function handleMouseUp() {
		isDraggingSatBright = false;
		isDraggingHue = false;
	}

	function handleHexInput(e: Event) {
		let value = (e.target as HTMLInputElement).value.toUpperCase();
		if (!value.startsWith('#')) value = '#' + value;
		if (/^#[0-9A-F]{6}$/.test(value)) {
			hex = value;
			const hsv = hexToHsv(value);
			hue = hsv.h;
			saturation = hsv.s;
			brightness = hsv.v;
			drawSatBrightPicker();
			onUserInteraction();
		} else if (/^#[0-9A-F]{0,6}$/.test(value)) {
			hex = value;
		}
	}

	async function saveColor() {
		try {
			hexToRgb(hex);
			await setValue('mods.builtin.icon_color', hex, true);
		} catch {
			// Invalid hex
		}
	}

	async function generateCache() {
		if (isGenerating) return;

		try {
			hexToRgb(hex);
		} catch {
			return;
		}

		isGenerating = true;

		try {
			await generateIconColorCache(hex);
			logger.info(`Generated icon color cache with color: ${hex}`);
		} catch (e) {
			const error = e as Error;
			logger.error('Failed to generate icon color cache:', error);
			toast.error(`Failed to generate icon color: ${error.message}`);
		} finally {
			isGenerating = false;
		}
	}

	function debouncedGenerate() {
		if (!initialized) return;

		saveColor();

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(() => {
			generateCache();
		}, 500);
	}

	// Track if user has interacted (to avoid regenerating on mount)
	let userInteracted = false;

	function onUserInteraction() {
		userInteracted = true;
		debouncedGenerate();
	}

	// Picker indicator positions
	$: satBrightX = saturation;
	$: satBrightY = 100 - brightness;
	$: hueX = (hue / 360) * 100;
</script>

<svelte:window
	on:mousemove={(e) => {
		handleSatBrightMove(e);
		handleHueMove(e);
	}}
	on:mouseup={handleMouseUp}
/>

<div class="color-picker">
	<!-- Saturation/Brightness picker -->
	<div class="sat-bright-container">
		<canvas
			bind:this={satBrightCanvas}
			width="240"
			height="150"
			class="sat-bright-canvas"
			on:mousedown={handleSatBrightMouseDown}
		></canvas>
		<div class="sat-bright-indicator" style="left: {satBrightX}%; top: {satBrightY}%;"></div>
	</div>

	<!-- Hue slider -->
	<div class="hue-container">
		<canvas bind:this={hueCanvas} width="240" height="16" class="hue-canvas" on:mousedown={handleHueMouseDown}></canvas>
		<div class="hue-indicator" style="left: {hueX}%;"></div>
	</div>

	<!-- Hex input -->
	<div class="hex-row">
		<span class="hex-label">Hex:</span>
		<input type="text" value={hex} on:input={handleHexInput} maxlength="7" class="hex-input" />
		{#if isGenerating}
			<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
		{/if}
	</div>
</div>

<style>
	.color-picker {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 260px;
		padding: 16px;
		margin-top: 8px;
		background: hsl(var(--muted) / 0.3);
		border: 1px solid hsl(var(--border));
		border-radius: 10px;
	}

	.sat-bright-container {
		position: relative;
		width: 100%;
		height: 160px;
		border-radius: 8px;
		overflow: hidden;
	}

	.sat-bright-canvas {
		width: 100%;
		height: 100%;
		cursor: crosshair;
		border-radius: 8px;
	}

	.sat-bright-indicator {
		position: absolute;
		width: 18px;
		height: 18px;
		border: 2px solid white;
		border-radius: 50%;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.3),
			inset 0 0 0 1px rgba(0, 0, 0, 0.3);
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	.hue-container {
		position: relative;
		width: 100%;
		height: 14px;
		border-radius: 7px;
		overflow: visible;
	}

	.hue-canvas {
		width: 100%;
		height: 100%;
		cursor: pointer;
		border-radius: 7px;
	}

	.hue-indicator {
		position: absolute;
		top: 50%;
		width: 18px;
		height: 18px;
		background: white;
		border: 2px solid white;
		border-radius: 50%;
		box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	.hex-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 4px;
	}

	.hex-label {
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
	}

	.hex-input {
		height: 34px;
		width: 100px;
		border-radius: 6px;
		border: 1px solid hsl(var(--input));
		background: hsl(var(--background));
		padding: 4px 10px;
		font-size: 0.875rem;
		font-family: monospace;
		text-transform: uppercase;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
		transition: border-color 0.15s;
	}

	.hex-input:focus {
		outline: none;
		border-color: hsl(var(--ring));
	}
</style>
