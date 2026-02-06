<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { os } from '@neutralinojs/lib';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Card from '$lib/components/ui/card/index';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import { storeRobloxCookie, deleteRobloxCookie, hasRobloxCookie } from '../../ts/tools/keychain';
	import { validateCookie, type UserInfo } from '../../ts/roblox/api';
	import { libraryPath } from '../../ts/libraries';
	import { spawn } from '../../ts/tools/shell';
	import Logger from '@/windows/main/ts/utils/logger';
	import { Key, Trash2, RefreshCw, ShieldCheck, ExternalLink, User, AlertTriangle, Globe } from 'lucide-svelte';
	import { Curl } from '../../ts/tools/curl';

	const logger = Logger.withContext('CookieSetup');
	const dispatch = createEventDispatcher();

	let hasCookie = false;
	let userInfo: UserInfo | null = null;
	let avatarUrl: string | null = null;
	let isLoading = true;
	let isValidating = false;
	let isWebViewLoginActive = false;
	let showSetupDialog = false;
	let showDeleteDialog = false;
	let cookieInput = '';

	async function fetchAvatar(userId: number): Promise<string | null> {
		try {
			const response = await Curl.get(
				`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=48x48&format=Png`
			);
			if (!response.success || !response.body) return null;
			const data = JSON.parse(response.body);
			if (data.data && data.data.length > 0 && data.data[0].imageUrl) {
				return data.data[0].imageUrl;
			}
			return null;
		} catch {
			return null;
		}
	}

	onMount(async () => {
		await checkCookieStatus();
	});

	async function checkCookieStatus() {
		isLoading = true;
		try {
			hasCookie = await hasRobloxCookie();
			if (hasCookie) {
				userInfo = await validateCookie();
				if (userInfo) {
					avatarUrl = await fetchAvatar(userInfo.id);
				} else {
					avatarUrl = null;
					logger.warn('Stored cookie is invalid or expired');
				}
			} else {
				avatarUrl = null;
			}
		} catch (err) {
			logger.error('Failed to check cookie status:', err);
		}
		isLoading = false;
	}

	async function handleWebViewLogin() {
		if (isWebViewLoginActive) return;
		isWebViewLoginActive = true;

		try {
			const loginPath = libraryPath('roblox_login');
			const process = await spawn(loginPath, [], { timeoutMs: 330000 }); // 5.5min (slightly longer than binary's 5min timeout)

			let stdoutBuffer = '';

			process.on('stdOut', (data: string) => {
				stdoutBuffer += data;
			});

			process.on('exit', async (exitCode: number) => {
				isWebViewLoginActive = false;

				const status = stdoutBuffer.trim();

				if (status === 'LOGIN_SUCCESS') {
					// Cookie was stored in Keychain by the native binary
					// Validate it and update UI
					const user = await validateCookie();
					if (user) {
						userInfo = user;
						hasCookie = true;
						avatarUrl = await fetchAvatar(user.id);
						toast.success(`Connected as ${user.displayName} (@${user.name})`);
						dispatch('change', { authenticated: true, user });
					} else {
						toast.error('Login succeeded but cookie validation failed. Please try again.');
					}
				} else if (status === 'LOGIN_CANCELLED') {
					// User closed the window - no toast needed
				} else if (status === 'LOGIN_TIMEOUT') {
					toast.warning('Login timed out. Please try again.');
				} else {
					toast.error('Login failed. Please try again or use manual cookie entry.');
					logger.error('WebView login returned unexpected status:', status);
				}
			});
		} catch (err) {
			isWebViewLoginActive = false;
			logger.error('Failed to launch login webview:', err);
			toast.error('Failed to open login window');
		}
	}

	async function handleSaveCookie() {
		if (!cookieInput.trim()) {
			toast.error('Please enter your cookie');
			return;
		}

		isValidating = true;

		try {
			// First, store the cookie
			const stored = await storeRobloxCookie(cookieInput.trim());

			if (!stored) {
				toast.error('Failed to store cookie in Keychain');
				isValidating = false;
				return;
			}

			// Then validate it
			const user = await validateCookie();

			if (user) {
				userInfo = user;
				hasCookie = true;
				avatarUrl = await fetchAvatar(user.id);
				cookieInput = '';
				showSetupDialog = false;
				toast.success(`Connected as ${user.displayName} (@${user.name})`);
				dispatch('change', { authenticated: true, user });
			} else {
				// Cookie stored but invalid - delete it
				await deleteRobloxCookie();
				toast.error('Invalid or expired cookie. Please try again.');
			}
		} catch (err) {
			logger.error('Failed to save cookie:', err);
			toast.error('Failed to save cookie');
		}

		isValidating = false;
	}

	async function handleDeleteCookie() {
		try {
			await deleteRobloxCookie();
			hasCookie = false;
			userInfo = null;
			avatarUrl = null;
			showDeleteDialog = false;
			toast.success('Cookie removed');
			dispatch('change', { authenticated: false });
		} catch (err) {
			logger.error('Failed to delete cookie:', err);
			toast.error('Failed to remove cookie');
		}
	}

	async function handleRefresh() {
		await checkCookieStatus();
		if (hasCookie && userInfo) {
			toast.success('Account verified');
		} else if (hasCookie && !userInfo) {
			toast.warning('Cookie expired. Please re-authenticate.');
		}
	}

	function openCookieGuide() {
		os.open('https://github.com/AppleBlox/AppleBlox/wiki/How-to-Get-Your-Roblox-Cookie');
	}
</script>

<Card.Root class="border-border/50">
	<Card.Header class="pb-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Key class="w-5 h-5 text-muted-foreground" />
				<Card.Title class="text-base">Roblox Account</Card.Title>
			</div>
			{#if hasCookie && userInfo}
				<Badge variant="default" class="bg-green-500/20 text-green-500 hover:bg-green-500/30">Connected</Badge>
			{:else if hasCookie && !userInfo}
				<Badge variant="destructive" class="bg-orange-500/20 text-orange-500 hover:bg-orange-500/30">Expired</Badge>
			{:else}
				<Badge variant="secondary">Not Connected</Badge>
			{/if}
		</div>
		<Card.Description>
			Connect your Roblox account to enable advanced features like preferred region selection.
		</Card.Description>
	</Card.Header>

	<Card.Content>
		{#if isLoading}
			<div class="flex items-center justify-center py-4">
				<RefreshCw class="w-5 h-5 animate-spin text-muted-foreground" />
			</div>
		{:else if hasCookie && userInfo}
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					{#if avatarUrl}
						<img src={avatarUrl} alt={userInfo.displayName} class="w-10 h-10 rounded-full object-cover" />
					{:else}
						<div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
							<User class="w-5 h-5 text-muted-foreground" />
						</div>
					{/if}
					<div>
						<p class="font-medium">{userInfo.displayName}</p>
						<p class="text-sm text-muted-foreground">@{userInfo.name}</p>
					</div>
				</div>
				<div class="flex gap-2">
					<Button variant="ghost" size="icon" on:click={handleRefresh}>
						<RefreshCw class="w-4 h-4" />
					</Button>
					<Button variant="ghost" size="icon" class="text-destructive" on:click={() => (showDeleteDialog = true)}>
						<Trash2 class="w-4 h-4" />
					</Button>
				</div>
			</div>
		{:else if hasCookie && !userInfo}
			<div class="space-y-3">
				<div class="flex items-center gap-2 text-orange-500">
					<AlertTriangle class="w-4 h-4" />
					<span class="text-sm">Your cookie has expired. Please re-authenticate.</span>
				</div>
				<div class="flex gap-2">
					<Button variant="default" on:click={handleWebViewLogin} disabled={isWebViewLoginActive}>
						{#if isWebViewLoginActive}
							<RefreshCw class="w-4 h-4 mr-2 animate-spin" />
							Signing in...
						{:else}
							<Globe class="w-4 h-4 mr-2" />
							Sign in with Browser
						{/if}
					</Button>
					<Button variant="outline" on:click={() => (showSetupDialog = true)}>Manual</Button>
					<Button variant="ghost" on:click={() => (showDeleteDialog = true)}>Remove</Button>
				</div>
			</div>
		{:else}
			<div class="space-y-3">
				<p class="text-sm text-muted-foreground">
					To use region selection, you need to connect your Roblox account. This is stored securely in your Mac's
					Keychain.
				</p>
				<div class="flex gap-2">
					<Button variant="default" on:click={handleWebViewLogin} disabled={isWebViewLoginActive}>
						{#if isWebViewLoginActive}
							<RefreshCw class="w-4 h-4 mr-2 animate-spin" />
							Signing in...
						{:else}
							<Globe class="w-4 h-4 mr-2" />
							Sign in with Browser
						{/if}
					</Button>
					<Button variant="outline" on:click={() => (showSetupDialog = true)}>
						<Key class="w-4 h-4 mr-2" />
						Manual Cookie Entry
					</Button>
				</div>
			</div>
		{/if}
	</Card.Content>
</Card.Root>

<!-- Manual Cookie Setup Dialog -->
<AlertDialog.Root bind:open={showSetupDialog}>
	<AlertDialog.Content class="max-w-lg">
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				<ShieldCheck class="w-5 h-5 text-primary" />
				Manual Cookie Entry
			</AlertDialog.Title>
			<AlertDialog.Description class="text-left space-y-3">
				<p>
					Enter your <code class="bg-muted px-1 py-0.5 rounded text-xs">.ROBLOSECURITY</code> cookie to enable advanced features.
				</p>

				<div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
					<p class="font-medium text-yellow-500 flex items-center gap-1">
						<AlertTriangle class="w-4 h-4" />
						Security Notice
					</p>
					<ul class="mt-2 space-y-1 text-muted-foreground">
						<li>Your cookie is stored in macOS Keychain (encrypted)</li>
						<li>It's never sent anywhere except Roblox.com</li>
						<li>Never share your cookie with anyone</li>
					</ul>
				</div>
			</AlertDialog.Description>
		</AlertDialog.Header>

		<div class="space-y-3 py-4">
			<Textarea
				bind:value={cookieInput}
				placeholder="Paste your .ROBLOSECURITY cookie here..."
				class="min-h-[100px] font-mono text-xs"
			/>

			<button on:click={openCookieGuide} class="text-sm text-primary hover:underline flex items-center gap-1">
				<ExternalLink class="w-3 h-3" />
				How do I get my cookie?
			</button>
		</div>

		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={isValidating}>Cancel</AlertDialog.Cancel>
			<Button on:click={handleSaveCookie} disabled={isValidating || !cookieInput.trim()}>
				{#if isValidating}
					<RefreshCw class="w-4 h-4 mr-2 animate-spin" />
					Validating...
				{:else}
					<ShieldCheck class="w-4 h-4 mr-2" />
					Save Securely
				{/if}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={showDeleteDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Remove Account?</AlertDialog.Title>
			<AlertDialog.Description>
				This will remove your stored Roblox cookie. Region selection features will be disabled until you re-authenticate.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={handleDeleteCookie} class="bg-destructive text-destructive-foreground">
				Remove
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
