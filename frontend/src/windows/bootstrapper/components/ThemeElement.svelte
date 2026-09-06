<script lang="ts">
	import type { ThemeElement } from '../wpfui-theme';
	import Logo from '@/assets/appleblox.svg';

	export let el: ThemeElement;
	export let text: string;
	export let progress: number;
	export let resolveThemeUrl: (url: string) => string;

	function getProgressStyle(e: ThemeElement): string {
		const bg = e.progressBgColor ?? 'rgba(128, 128, 128, 0.2)';
		return `${e.style}; background: ${bg}`;
	}

	function getProgressRingStyle(e: ThemeElement): string {
		return e.style;
	}

	// Compute stroke-dasharray for determinate progress ring
	// SVG circle circumference for r=15.9155 is ~100 (using 2π×r ≈ 100 for easy percentage math)
	$: ringProgress = Math.min(100, Math.max(0, progress));

	const CONTAINERS = new Set(['Border', 'Grid', 'StackPanel', 'Canvas', 'DockPanel', 'WrapPanel', 'Button']);
</script>

{#if el.isIcon}
	<img src={Logo} alt="AppleBlox" style={el.style} />
{:else if el.isThemeImage && el.source}
	{#if el.isAnimated}
		<img src={resolveThemeUrl(el.source)} alt="" style={el.style} />
	{:else}
		<img src={resolveThemeUrl(el.source)} alt="" style={el.style} />
	{/if}
{:else if el.isProgressRing}
	<div style={getProgressRingStyle(el)} class:progress-ring-indeterminate={el.isIndeterminate}>
		<svg viewBox="0 0 36 36" class="progress-ring-svg" style="width:100%;height:100%">
			<circle class="progress-ring-track" cx="18" cy="18" r="15.9155" />
			<circle
				class="progress-ring-fill"
				cx="18"
				cy="18"
				r="15.9155"
				stroke={el.progressFgColor ?? '#0078d4'}
				stroke-dasharray="{el.isIndeterminate ? '25 75' : `${ringProgress} ${100 - ringProgress}`}"
			/>
		</svg>
	</div>
{:else if el.isLine && el.lineGeometry}
	<svg style={el.style} overflow="visible">
		<line
			x1={el.lineGeometry.x1}
			y1={el.lineGeometry.y1}
			x2={el.lineGeometry.x2}
			y2={el.lineGeometry.y2}
			stroke={el.lineGeometry.strokeColor}
			stroke-width={el.lineGeometry.strokeWidth}
		/>
	</svg>
{:else if el.tag === 'Rectangle' && (el.shapeStroke || el.shapeRadiusX || el.shapeRadiusY)}
	<svg style={el.style}>
		<rect
			width="100%"
			height="100%"
			fill={el.shapeFill ?? 'transparent'}
			stroke={el.shapeStroke ?? 'none'}
			stroke-width={el.shapeStrokeWidth ?? 0}
			rx={el.shapeRadiusX ?? 0}
			ry={el.shapeRadiusY ?? 0}
		/>
	</svg>
{:else if el.tag === 'Ellipse' && el.shapeStroke}
	<svg style={el.style}>
		<ellipse
			cx="50%"
			cy="50%"
			rx="50%"
			ry="50%"
			fill={el.shapeFill ?? 'transparent'}
			stroke={el.shapeStroke}
			stroke-width={el.shapeStrokeWidth ?? 1}
		/>
	</svg>
{:else if el.isProgressBar}
	<div class="progress-bar" class:indeterminate={el.isIndeterminate} style={getProgressStyle(el)}>
		{#if !el.isIndeterminate}
			<div class="progress-fill" style="background: {el.progressFgColor ?? '#0078d4'}; width: {progress}%; height: 100%; transition: width 0.4s ease;"></div>
		{/if}
	</div>
{:else if el.isStatusText}
	<p style={el.style}>{text}</p>
{:else if el.isCancelButton}
	<!-- Cancel button not shown in AppleBlox -->
{:else if el.tag === 'TextBlock' || el.tag === 'MarkdownTextBlock' || el.tag === 'Label'}
	<p style={el.style}>{el.textContent ?? ''}</p>
{:else if CONTAINERS.has(el.tag)}
	<div style={el.style}>
		{#each el.children as child, i (child.name ?? i)}
			<svelte:self el={child} {text} {progress} {resolveThemeUrl} />
		{/each}
	</div>
{/if}

<style>
	/* Progress bar fill */
	.progress-fill {
		height: 100%;
		border-radius: inherit;
	}

	/* All progress bars need a positioning context to clip ::before/::after */
	.progress-bar {
		position: relative;
		overflow: hidden;
	}
	.progress-bar.indeterminate::before {
		content: '';
		position: absolute;
		inset: 0 -100%;
		background: linear-gradient(90deg, transparent 25%, var(--fg, #0078d4) 50%, transparent 75%);
		animation: marquee 1.5s linear infinite;
	}
	@keyframes marquee {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(100%);
		}
	}

	/* Progress ring */
	.progress-ring-svg {
		transform: rotate(-90deg);
	}
	.progress-ring-track {
		fill: none;
		stroke: rgba(128, 128, 128, 0.2);
		stroke-width: 3.5;
	}
	.progress-ring-fill {
		fill: none;
		stroke-width: 3.5;
		stroke-linecap: round;
		stroke-dasharray: 0 100;
		transition: stroke-dasharray 0.4s ease;
	}
	.progress-ring-indeterminate .progress-ring-fill {
		stroke-dasharray: 25 75;
		animation: ring-spin 1s linear infinite;
		transform-origin: center;
		transform-box: fill-box;
	}
	@keyframes ring-spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* WinUI-like cancel button */
	/* .cancel-btn {
		border-radius: 4px;
		border: 1px solid rgba(160, 160, 160, 0.4);
		padding: 4px 16px;
		background: rgba(128, 128, 128, 0.08);
		font-family: inherit;
		font-size: 14px;
		cursor: not-allowed;
		opacity: 0.55;
		color: inherit;
	} */
</style>
