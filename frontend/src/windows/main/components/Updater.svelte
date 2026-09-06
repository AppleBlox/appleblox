<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { app, events, filesystem, os } from '@neutralinojs/lib';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { toast } from 'svelte-sonner';
	import { version } from '../../../../../package.json';
	import { Curl } from '../ts/tools/curl';
	import { shell } from '../ts/tools/shell';
	import * as shellfs from '../ts/tools/shellfs';
	import Logger from '../ts/utils/logger';
	import { getCacheDir } from '../ts/utils/paths';
	import MarkdownViewer from './markdown-viewer.svelte';
	import { loadSettings, saveSettings } from './settings';

	let showUpdatePopup = false;
	let showProgressPopup = false;
	let updateVersion = version;
	let body = '';

	let stage: 'idle' | 'downloading' | 'extracting' | 'installing' | 'done' | 'error' = 'idle';
	let progressPercent = 0;
	let progressLabel = '';
	let progressDetail = '';
	let errorMessage = '';
	let devMode = false;

	let showVersionPrompt = false;
	let versionInput = '0.9.0';
	let versionInputError = '';
	let versionPromptBusy = false;

	type ReleaseAsset = { name: string; browser_download_url: string; size: number };
	let selectedAsset: ReleaseAsset | null = null;

	async function fetchRelease(tag: string): Promise<{ body: string; assets: ReleaseAsset[] }> {
		const res = await Curl.get(`https://api.github.com/repos/AppleBlox/appleblox/releases/tags/${tag}`);
		if (!res.success || !res.body) {
			throw new Error(`Could not fetch release metadata: ${res.error || 'no response'}`);
		}
		if (res.statusCode && res.statusCode >= 400) {
			throw new Error(`Release v${tag} not found on GitHub (HTTP ${res.statusCode}).`);
		}
		let data: { body?: string; assets?: ReleaseAsset[] };
		try {
			data = JSON.parse(res.body);
		} catch {
			throw new Error('Could not parse GitHub release response');
		}
		return { body: data.body ?? '', assets: data.assets ?? [] };
	}

	function pickPkgAsset(assets: ReleaseAsset[], arch: string): ReleaseAsset | null {
		return (
			assets.find((a) => {
				const n = a.name.toLowerCase();
				return n.endsWith('.pkg') && n.includes(arch);
			}) ?? null
		);
	}

	type SemVer = { major: number; minor: number; patch: number; pre: string[] };

	function parseVersion(v: string): SemVer | null {
		const m = v.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
		if (!m) return null;
		return {
			major: parseInt(m[1]),
			minor: parseInt(m[2]),
			patch: parseInt(m[3]),
			pre: m[4] ? m[4].split('.') : [],
		};
	}

	function versionGreater(a: string, b: string): boolean {
		const pa = parseVersion(a);
		const pb = parseVersion(b);
		if (!pa || !pb) return false;
		if (pa.major !== pb.major) return pa.major > pb.major;
		if (pa.minor !== pb.minor) return pa.minor > pb.minor;
		if (pa.patch !== pb.patch) return pa.patch > pb.patch;

		if (pa.pre.length === 0 && pb.pre.length > 0) return true;
		if (pa.pre.length > 0 && pb.pre.length === 0) return false;

		const len = Math.max(pa.pre.length, pb.pre.length);
		for (let i = 0; i < len; i++) {
			const x = pa.pre[i];
			const y = pb.pre[i];
			if (x === undefined) return false;
			if (y === undefined) return true;
			const xn = Number(x);
			const yn = Number(y);
			const xIsNum = !isNaN(xn);
			const yIsNum = !isNaN(yn);
			if (xIsNum && yIsNum) {
				if (xn !== yn) return xn > yn;
			} else if (xIsNum !== yIsNum) {
				return !xIsNum;
			} else if (x !== y) {
				return x > y;
			}
		}
		return false;
	}

	function isProductionBundle(): boolean {
		const nlPath = window.NL_PATH || '';
		return nlPath.includes('.app/Contents/Resources');
	}

	function getArch(): string {
		switch (window.NL_ARCH as unknown as string) {
			case 'x64':
				return 'x64';
			case 'arm':
				return 'arm64';
		}
		return 'arm64';
	}

	async function checkForUpdate() {
		const checkWifi = await shell(
			`if ping -c 1 -W 1 8.8.8.8 &> /dev/null; then echo "true"; else echo "false"; fi`,
			[],
			{ completeCommand: true }
		);
		if (!checkWifi.stdOut.includes('true')) {
			toast.error('Could not connect to internet');
			return;
		}
		const response = await Curl.get('https://api.github.com/repos/AppleBlox/appleblox/releases');
		if (!response.success || !response.body) {
			Logger.error(`Failed to fetch version info: ${response.error || 'No response body'}`);
			return;
		}
		const releases = JSON.parse(response.body);
		if (!Array.isArray(releases)) return;

		let best = version;
		let bestBody = '';
		let bestAssets: ReleaseAsset[] = [];
		for (const re of releases) {
			if (versionGreater(re.tag_name, best)) {
				best = re.tag_name;
				bestBody = re.body;
				bestAssets = re.assets ?? [];
			}
		}
		if (best === version) return;

		const arch = getArch();
		const asset = pickPkgAsset(bestAssets, arch);
		if (!asset) {
			Logger.warn(`Release ${best} has no ${arch} PKG asset, skipping update prompt`);
			return;
		}
		selectedAsset = asset;
		updateVersion = best;
		body = bestBody || `*No changelog provided for v${best}.*`;
		Logger.info(`A new release is available: ${updateVersion}`);

		const settings = await loadSettings('updating');
		if (settings) {
			const timeDiff = Math.round((Date.now() - settings.date) / (1000 * 3600 * 24));
			if (timeDiff <= 7) return;
		}
		showUpdatePopup = true;
	}

	async function startInstall() {
		showUpdatePopup = false;
		if (!isProductionBundle()) {
			toast.error('Auto-update is only available when running from the built .app bundle. Download manually from GitHub.');
			os.open(selectedAsset?.browser_download_url ?? `https://github.com/AppleBlox/appleblox/releases/tag/${updateVersion}`);
			return;
		}
		showProgressPopup = true;
		await performUpdate();
	}

	async function submitVersionPrompt() {
		if (versionPromptBusy) return;
		const entered = versionInput.trim().replace(/^v/, '');
		const parsed = parseVersion(entered);
		if (!parsed) {
			versionInputError = 'Invalid version format. Expected x.y.z or x.y.z-tag.n';
			return;
		}
		if (!(versionGreater(entered, '0.9.0') || entered === '0.9.0')) {
			versionInputError = 'Version must be >= 0.9.0';
			return;
		}
		versionInputError = '';
		versionPromptBusy = true;
		try {
			const release = await fetchRelease(entered);
			const arch = getArch();
			const asset = pickPkgAsset(release.assets, arch);
			if (!asset) {
				const available = release.assets.map((a) => a.name).join(', ') || 'none';
				versionInputError = `No ${arch} PKG asset in this release. Available: ${available}`;
				return;
			}
			selectedAsset = asset;
			updateVersion = entered;
			body = release.body || `*No changelog provided for v${entered}.*`;
			devMode = true;
			showVersionPrompt = false;
			showUpdatePopup = true;
		} catch (e) {
			versionInputError = e instanceof Error ? e.message : String(e);
		} finally {
			versionPromptBusy = false;
		}
	}

	async function performUpdate() {
		try {
			if (!isProductionBundle()) {
				throw new Error('Refusing to run: not in a production .app bundle');
			}

			const currentAppPath = window.NL_PATH.replace('/Contents/Resources', '');
			if (!currentAppPath.endsWith('.app')) {
				throw new Error(`Refusing to run: resolved app path is not a .app bundle (${currentAppPath})`);
			}
			const currentMacOS = `${currentAppPath}/Contents/MacOS`;
			if (!(await shellfs.exists(currentMacOS))) {
				throw new Error(`Refusing to run: ${currentMacOS} does not exist`);
			}
			const writeCheck = await shell('test', ['-w', currentAppPath], { skipStderrCheck: true });
			if (writeCheck.exitCode !== 0) {
				throw new Error(`No write permission on ${currentAppPath}`);
			}

			const arch = getArch();
			let pkgAsset = selectedAsset;
			if (!pkgAsset) {
				const release = await fetchRelease(updateVersion);
				pkgAsset = pickPkgAsset(release.assets, arch);
				if (!pkgAsset) {
					const available = release.assets.map((a) => a.name).join(', ') || 'none';
					throw new Error(`No ${arch} PKG asset found in release v${updateVersion}. Available: ${available}`);
				}
			}
			const pkgUrl = pkgAsset.browser_download_url;

			const cacheDir = await getCacheDir();
			const updateDir = `${cacheDir}/update-${Date.now()}`;
			await shellfs.createDirectory(updateDir);
			const pkgPath = `${updateDir}/installer.pkg`;

			stage = 'downloading';
			progressLabel = 'Downloading update';
			progressDetail = pkgAsset.name;
			progressPercent = 0;

			const dl = await Curl.downloadWithProgress(pkgUrl, {
				outputPath: pkgPath,
				followRedirects: true,
				onProgress: (progress) => {
					progressPercent = Math.max(0, Math.min(100, progress.percentage));
					const mbDone = (progress.downloadedSize / 1024 / 1024).toFixed(1);
					const mbTotal = progress.totalSize ? (progress.totalSize / 1024 / 1024).toFixed(1) : '?';
					const mbPerSec = (progress.downloadSpeed / 1024 / 1024).toFixed(2);
					progressDetail = `${mbDone} MB / ${mbTotal} MB  •  ${mbPerSec} MB/s`;
				},
			});

			if (!dl.success) {
				throw new Error(`Download failed: ${dl.error || 'unknown'}`);
			}
			if (dl.statusCode && dl.statusCode >= 400) {
				throw new Error(`PKG download failed with HTTP ${dl.statusCode} from ${pkgUrl}`);
			}
			const pkgStat = await filesystem.getStats(pkgPath);
			if (!pkgStat || pkgStat.size < 1024 * 100) {
				throw new Error(`Downloaded file is too small (${pkgStat?.size ?? 0} bytes) — likely not a real PKG.`);
			}
			const sigCheck = await shell('xxd', ['-p', '-l', '4', pkgPath], { skipStderrCheck: true });
			const sig = sigCheck.stdOut.replace(/\s/g, '');
			if (!sig.startsWith('78617221')) {
				throw new Error(`Downloaded file is not a valid PKG (expected xar signature, got "${sig}").`);
			}

			stage = 'extracting';
			progressLabel = 'Extracting package';
			progressDetail = 'Unpacking installer contents...';
			progressPercent = 0;

			const expandDir = `${updateDir}/expanded`;
			const expandRes = await shell('pkgutil', ['--expand-full', pkgPath, expandDir]);
			if (expandRes.exitCode !== 0) {
				throw new Error(`pkgutil failed: ${expandRes.stdErr || 'unknown error'}`);
			}
			progressPercent = 60;

			const findRes = await shell(
				`find "${expandDir}" -type d -name "AppleBlox.app" -maxdepth 6 | head -n 1`,
				[],
				{ completeCommand: true, skipStderrCheck: true }
			);
			const newAppPath = findRes.stdOut.trim();
			if (!newAppPath || !newAppPath.endsWith('.app')) {
				throw new Error('Could not locate AppleBlox.app inside the package');
			}
			if (!(await shellfs.exists(`${newAppPath}/Contents/MacOS`))) {
				throw new Error('Extracted app bundle is invalid (missing Contents/MacOS)');
			}
			progressPercent = 100;

			stage = 'installing';
			progressLabel = 'Installing update';
			progressDetail = 'AppleBlox will restart in a moment...';

			const swapScript = `${updateDir}/swap.sh`;
			const parentPid = String(window.NL_PID ?? '');
			const scriptContent = `#!/bin/bash
set -e
NEW_APP="${newAppPath}"
CURRENT_APP="${currentAppPath}"
TMP_DIR="${updateDir}"
PARENT_PID="${parentPid}"

case "$CURRENT_APP" in
    *.app) ;;
    *) echo "safety: CURRENT_APP is not .app" >&2; exit 2 ;;
esac
case "$NEW_APP" in
    *.app) ;;
    *) echo "safety: NEW_APP is not .app" >&2; exit 3 ;;
esac
if [ ! -d "$CURRENT_APP/Contents/MacOS" ]; then
    echo "safety: CURRENT_APP/Contents/MacOS missing" >&2
    exit 4
fi
if [ ! -d "$NEW_APP/Contents/MacOS" ]; then
    echo "safety: NEW_APP/Contents/MacOS missing" >&2
    exit 5
fi

if [ -n "$PARENT_PID" ]; then
    for i in $(seq 1 120); do
        if ! kill -0 "$PARENT_PID" 2>/dev/null; then break; fi
        sleep 0.5
    done
fi
sleep 1

rm -rf "$CURRENT_APP"
cp -R "$NEW_APP" "$CURRENT_APP"
xattr -cr "$CURRENT_APP" 2>/dev/null || true

LOGGED_IN_USER=$(stat -f "%Su" /dev/console 2>/dev/null)
if [ -n "$LOGGED_IN_USER" ] && [ "$LOGGED_IN_USER" != "root" ]; then
    chown -R "$LOGGED_IN_USER" "$CURRENT_APP" 2>/dev/null || true
fi

rm -rf "$TMP_DIR"
open "$CURRENT_APP"
`;
			await filesystem.writeFile(swapScript, scriptContent);
			await shell('chmod', ['+x', swapScript], { skipStderrCheck: true });

			stage = 'done';
			progressLabel = 'Restarting';
			progressDetail = 'Applying update and relaunching...';
			await new Promise((r) => setTimeout(r, 800));

			await shell(`nohup bash "${swapScript}" > /dev/null 2>&1 &`, [], { completeCommand: true });
			await new Promise((r) => setTimeout(r, 400));
			await app.exit();
		} catch (e) {
			Logger.error('Update failed:', e);
			stage = 'error';
			errorMessage = e instanceof Error ? e.message : String(e);
			toast.error('Update failed');
		}
	}

	function postponeUpdate() {
		saveSettings('updating', { date: Date.now() });
		showUpdatePopup = false;
	}

	function closeProgress() {
		if (stage === 'error' || stage === 'done') {
			showProgressPopup = false;
			stage = 'idle';
			devMode = false;
		}
	}

	onMount(() => {
		checkForUpdate();
		events.on('dev:fake-update', () => {
			versionInput = '0.9.0';
			versionInputError = '';
			showVersionPrompt = true;
		});
	});
</script>

<AlertDialog.Root bind:open={showUpdatePopup} closeOnOutsideClick={true} closeOnEscape={true}>
	<AlertDialog.Content class="max-h-[85vh] max-w-2xl overflow-hidden flex flex-col">
		<AlertDialog.Header class="flex-shrink-0">
			<AlertDialog.Title class="flex items-center gap-2">
				A new version is available
				{#if devMode}
					<span class="text-xs font-mono px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600">DEV</span>
				{/if}
			</AlertDialog.Title>
			<AlertDialog.Description class="text-muted-foreground text-sm">
				v{version} → <span class="text-primary font-semibold">v{updateVersion}</span>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<div class="flex-1 overflow-y-auto border-t border-b py-3 my-2">
			<MarkdownViewer
				content={body}
				class="prose-sm prose-headings:mt-2 prose-headings:mb-1 prose-h1:text-base prose-h1:font-semibold prose-h2:text-sm prose-h3:text-sm prose-p:my-1 prose-p:leading-snug prose-ul:my-1 prose-ol:my-1 prose-li:my-0"
			/>
		</div>
		<AlertDialog.Footer class="flex-shrink-0">
			<Button variant="ghost" on:click={postponeUpdate}>Remind me later</Button>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<Button on:click={startInstall}>Install update</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={showProgressPopup} closeOnOutsideClick={false} closeOnEscape={false}>
	<AlertDialog.Content class="max-w-md">
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				{#if stage === 'error'}
					Update failed
				{:else if stage === 'done'}
					Update complete
				{:else}
					Updating AppleBlox
				{/if}
				{#if devMode}
					<span class="text-xs font-mono px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600">DEV</span>
				{/if}
			</AlertDialog.Title>
			<AlertDialog.Description class="text-muted-foreground text-sm">
				v{version} → v{updateVersion}
			</AlertDialog.Description>
		</AlertDialog.Header>

		<div class="py-4 space-y-3">
			{#if stage === 'error'}
				<div in:fade class="text-sm text-destructive break-words">{errorMessage}</div>
			{:else}
				<div class="flex items-center justify-between text-sm">
					<span class="font-medium">{progressLabel}</span>
					{#if stage === 'downloading' || stage === 'extracting'}
						<span class="text-muted-foreground tabular-nums">{Math.round(progressPercent)}%</span>
					{/if}
				</div>
				<Progress value={progressPercent} max={100} />
				{#if progressDetail}
					<div in:fly={{ y: 4, duration: 200 }} class="text-xs text-muted-foreground tabular-nums">
						{progressDetail}
					</div>
				{/if}
			{/if}
		</div>

		{#if stage === 'error'}
			<AlertDialog.Footer>
				<Button on:click={closeProgress}>Close</Button>
			</AlertDialog.Footer>
		{/if}
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={showVersionPrompt} closeOnOutsideClick={true} closeOnEscape={true}>
	<AlertDialog.Content class="max-w-md">
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				Dev update
				<span class="text-xs font-mono px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600">DEV</span>
			</AlertDialog.Title>
			<AlertDialog.Description class="text-muted-foreground text-sm">
				Enter a version to download and install. Must be ≥ 0.9.0. This runs the <strong>real</strong> update flow — AppleBlox
				will download the PKG from GitHub, extract it, and restart.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<div class="py-4 space-y-2">
			<Input
				type="text"
				placeholder="0.9.0"
				bind:value={versionInput}
				on:keydown={(e) => {
					if (e.key === 'Enter') submitVersionPrompt();
				}}
			/>
			{#if versionInputError}
				<div class="text-xs text-destructive">{versionInputError}</div>
			{/if}
			<div class="text-xs text-muted-foreground">
				Will look up the release via the GitHub API and pick the first <code>.pkg</code> asset matching
				<code>{getArch()}</code>.
			</div>
		</div>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={versionPromptBusy}>Cancel</AlertDialog.Cancel>
			<Button on:click={submitVersionPrompt} disabled={versionPromptBusy}>
				{versionPromptBusy ? 'Fetching release…' : 'Continue'}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
