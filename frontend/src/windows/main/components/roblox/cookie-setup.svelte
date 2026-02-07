<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { os } from '@neutralinojs/lib';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Card from '$lib/components/ui/card/index';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import {
		getAccounts,
		getActiveUserId,
		setActiveAccount,
		addAccount,
		removeAccount,
		detectAccountFromBinaryCookies,
		updateAccountAvatar,
		isAccountInBinaryCookies,
		validateAllAccounts,
		type AccountInfo,
		launchRobloxWithActiveAccount,
	} from '../../ts/roblox/accounts';
	import { retrieveCredential, deleteCredential } from '../../ts/tools/keychain';
	import { libraryPath } from '../../ts/libraries';
	import { spawn } from '../../ts/tools/shell';
	import { Curl } from '../../ts/tools/curl';
	import Logger from '@/windows/main/ts/utils/logger';
	import {
		Key,
		Trash2,
		RefreshCw,
		ShieldCheck,
		ExternalLink,
		User,
		AlertTriangle,
		Globe,
		Check,
		UserPlus,
	} from 'lucide-svelte';

	const logger = Logger.withContext('CookieSetup');
	const dispatch = createEventDispatcher();

	let accounts: AccountInfo[] = [];
	let activeUserId: number | null = null;
	let isLoading = true;
	let isWebViewLoginActive = false;
	let showAddAccountDialog = false;
	let showManualEntryDialog = false;
	let showDeleteDialog = false;
	let accountToDelete: AccountInfo | null = null;
	let cookieInput = '';
	let isValidating = false;
	/** Set of userIds currently present in the Roblox binary cookies file */
	let lockedAccountIds: Set<number> = new Set();

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
		await loadAccounts();
	});

	async function loadAccounts() {
		isLoading = true;
		try {
			// Always auto-detect first
			try {
				await detectAccountFromBinaryCookies();
			} catch {
				// Detection may fail if Roblox isn't installed — that's fine
			}

			accounts = await getAccounts();
			activeUserId = await getActiveUserId();

			if (accounts.length > 0) {
				dispatch('change', { authenticated: true });
			}

			// Validate all accounts asynchronously (runs in background)
			validateAllAccounts().then(() => {
				// Reload accounts after validation to show updated status
				getAccounts().then((updatedAccounts) => {
					accounts = updatedAccounts;
				});
			});

			// Check which auto-detected accounts are still in the binary cookies file
			const newLocked = new Set<number>();
			for (const account of accounts) {
				if (account.source === 'auto-detect') {
					try {
						if (await isAccountInBinaryCookies(account.userId)) {
							newLocked.add(account.userId);
						}
					} catch {
						// If check fails, don't lock
					}
				}
			}
			lockedAccountIds = newLocked;

			// Fetch avatars for accounts that don't have one
			for (const account of accounts) {
				if (!account.avatarUrl && account.userId > 0) {
					const url = await fetchAvatar(account.userId);
					if (url) {
						account.avatarUrl = url;
						await updateAccountAvatar(account.userId, url);
					}
				}
			}
			// Trigger reactivity
			accounts = accounts;
		} catch (err) {
			logger.error('Failed to load accounts:', err);
		}
		isLoading = false;
	}

	async function handleSetActive(userId: number) {
		try {
			await setActiveAccount(userId);
			activeUserId = userId;
			const account = accounts.find((a) => a.userId === userId);
			if (account) {
				toast.success(`Switched to ${account.displayName}`);
			}
			await launchRobloxWithActiveAccount()
			dispatch('change', { authenticated: true });
		} catch (err) {
			logger.error('Failed to set active account:', err);
			toast.error('Failed to switch account');
		}
	}

	async function handleWebViewLogin() {
		if (isWebViewLoginActive) return;
		isWebViewLoginActive = true;
		showAddAccountDialog = false;

		try {
			const loginPath = libraryPath('roblox_login');
			const process = await spawn(loginPath, [], { timeoutMs: 330000 });

			let stdoutBuffer = '';

			process.on('stdOut', (data: string) => {
				stdoutBuffer += data;
			});

			process.on('exit', async (exitCode: number) => {
				isWebViewLoginActive = false;
				const status = stdoutBuffer.trim();

				if (status === 'LOGIN_SUCCESS') {
					// The native binary stores the cookie under the old 'roblox-cookie' key.
					// Read it, add to accounts, then clean up the old key.
					try {
						const cookie = await retrieveCredential('roblox-cookie');
						if (cookie) {
							const wasFirstAccount = accounts.length === 0;
							const account = await addAccount(cookie, 'webview');
							await deleteCredential('roblox-cookie');
							toast.success(`Connected as ${account.displayName} (@${account.username})`);
							dispatch('change', { authenticated: true });
							await loadAccounts();

							// Launch Roblox if this is the first account
							if (wasFirstAccount) {
								try {
									await launchRobloxWithActiveAccount();
								} catch (err) {
									logger.error('Failed to launch Roblox with new account:', err);
								}
							}
						} else {
							toast.error('Login succeeded but could not read cookie. Please try again.');
						}
					} catch (err) {
						logger.error('Failed to process webview login result:', err);
						toast.error('Login succeeded but cookie validation failed. Please try again.');
					}
				} else if (status === 'LOGIN_CANCELLED') {
					// User closed the window
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

	function openManualEntry() {
		showAddAccountDialog = false;
		showManualEntryDialog = true;
	}

	async function handleSaveCookie() {
		if (!cookieInput.trim()) {
			toast.error('Please enter your cookie');
			return;
		}

		isValidating = true;

		try {
			const wasFirstAccount = accounts.length === 0;
			const account = await addAccount(cookieInput.trim(), 'manual');
			cookieInput = '';
			showManualEntryDialog = false;
			toast.success(`Connected as ${account.displayName} (@${account.username})`);
			dispatch('change', { authenticated: true });
			await loadAccounts();

			// Launch Roblox if this is the first account
			if (wasFirstAccount) {
				try {
					await launchRobloxWithActiveAccount();
				} catch (err) {
					logger.error('Failed to launch Roblox with new account:', err);
				}
			}
		} catch (err) {
			logger.error('Failed to save cookie:', err);
			toast.error('Invalid or expired cookie. Please try again.');
		}

		isValidating = false;
	}

	async function confirmDeleteAccount() {
		if (!accountToDelete) return;

		try {
			const wasActive = accountToDelete.userId === activeUserId;
			await removeAccount(accountToDelete.userId);
			showDeleteDialog = false;
			accountToDelete = null;
			toast.success('Account removed');

			await loadAccounts();

			if (wasActive) {
				activeUserId = await getActiveUserId();
				dispatch('change', { authenticated: activeUserId !== null });
			}
		} catch (err) {
			logger.error('Failed to delete account:', err);
			toast.error('Failed to remove account');
		}
	}

	function openCookieGuide() {
		os.open('https://github.com/AppleBlox/AppleBlox/wiki/How-to-Get-Your-Roblox-Cookie');
	}

	function sourceLabel(source: AccountInfo['source']): string {
		switch (source) {
			case 'auto-detect':
				return 'Auto-detected';
			case 'webview':
				return 'Browser';
			case 'manual':
				return 'Manual';
			default:
				return source;
		}
	}
</script>

<Card.Root class="border-border/50">
	<Card.Header class="pb-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Key class="w-5 h-5 text-muted-foreground" />
				<Card.Title class="text-base">Roblox Accounts</Card.Title>
			</div>
			{#if accounts.length > 0}
				<Badge variant="default" class="bg-green-500/20 text-green-500 hover:bg-green-500/30">
					{accounts.length} account{accounts.length !== 1 ? 's' : ''}
				</Badge>
			{:else}
				<Badge variant="secondary">Not Connected</Badge>
			{/if}
		</div>
		<Card.Description>
			Connect your Roblox accounts to enable advanced features like preferred region selection.
		</Card.Description>
	</Card.Header>

	<Card.Content>
		{#if isLoading}
			<div class="flex items-center justify-center py-4">
				<RefreshCw class="w-5 h-5 animate-spin text-muted-foreground" />
			</div>
		{:else}
			<!-- Account list -->
			{#if accounts.length === 0}
				<div class="py-8 text-center border border-dashed border-border/50 rounded-lg">
					<User class="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
					<p class="text-muted-foreground">No accounts connected</p>
					<p class="text-sm text-muted-foreground/70 mt-1">Add an account to get started</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each accounts as account (account.userId)}
						<div
							class="flex items-center justify-between p-3 rounded-lg border transition-colors
								{account.userId === activeUserId
								? 'border-primary/50 bg-primary/5'
								: 'border-border/50 hover:border-border'}"
						>
							<div class="flex items-center gap-3">
								{#if account.avatarUrl}
									<img
										src={account.avatarUrl}
										alt={account.displayName}
										class="w-10 h-10 rounded-full object-cover"
									/>
								{:else}
									<div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
										<User class="w-5 h-5 text-muted-foreground" />
									</div>
								{/if}
								<div>
									<div class="flex items-center gap-2">
										<p class="font-medium">{account.displayName}</p>
										{#if account.userId === activeUserId}
											<Badge variant="default" class="text-xs px-1.5 py-0">Active</Badge>
										{/if}
									</div>
									<div class="flex items-center gap-2">
										<p class="text-sm text-muted-foreground">@{account.username}</p>
										<Badge variant="outline" class="text-xs px-1.5 py-0 border-border/50">
											{sourceLabel(account.source)}
										</Badge>
										{#if account.lastValidated === 0}
											<Badge
												variant="destructive"
												class="text-xs px-1.5 py-0 bg-orange-500/20 text-orange-500"
											>
												Expired
											</Badge>
										{/if}
									</div>
								</div>
							</div>
							<div class="flex gap-1">
								{#if account.userId !== activeUserId}
									<Button variant="ghost" size="sm" on:click={() => handleSetActive(account.userId)}>
										<Check class="w-4 h-4 mr-1" />
										Set Active
									</Button>
								{/if}
								{#if !lockedAccountIds.has(account.userId)}
									<Button
										variant="ghost"
										size="icon"
										class="text-destructive hover:text-destructive"
										on:click={() => {
											accountToDelete = account;
											showDeleteDialog = true;
										}}
									>
										<Trash2 class="w-4 h-4" />
									</Button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Add account button -->
			<div class="mt-4">
				<Button variant="outline" on:click={() => (showAddAccountDialog = true)}>
					<UserPlus class="w-4 h-4 mr-2" />
					Add Account
				</Button>
			</div>
		{/if}
	</Card.Content>
</Card.Root>

<!-- Add Account Dialog -->
<AlertDialog.Root bind:open={showAddAccountDialog}>
	<AlertDialog.Content class="max-w-sm">
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				<UserPlus class="w-5 h-5 text-primary" />
				Add Account
			</AlertDialog.Title>
			<AlertDialog.Description>
				Choose how to add a Roblox account.
			</AlertDialog.Description>
		</AlertDialog.Header>

		<div class="space-y-2 py-4">
			<Button
				variant="default"
				class="w-full justify-start"
				on:click={handleWebViewLogin}
				disabled={isWebViewLoginActive}
			>
				{#if isWebViewLoginActive}
					<RefreshCw class="w-4 h-4 mr-2 animate-spin" />
					Signing in...
				{:else}
					<Globe class="w-4 h-4 mr-2" />
					Sign in with Browser
				{/if}
			</Button>
			<Button variant="outline" class="w-full justify-start" on:click={openManualEntry}>
				<Key class="w-4 h-4 mr-2" />
				Manual Cookie Entry
			</Button>
		</div>

		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Manual Cookie Entry Dialog -->
<AlertDialog.Root bind:open={showManualEntryDialog}>
	<AlertDialog.Content class="max-w-lg">
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				<ShieldCheck class="w-5 h-5 text-primary" />
				Manual Cookie Entry
			</AlertDialog.Title>
			<AlertDialog.Description class="text-left space-y-3">
				<p>
					Enter your <code class="bg-muted px-1 py-0.5 rounded text-xs">.ROBLOSECURITY</code> cookie to add
					an account.
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
				{#if accountToDelete}
					Remove <strong>{accountToDelete.displayName}</strong> (@{accountToDelete.username})? The stored
					cookie will be deleted from your Mac's Keychain.
					{#if accountToDelete.userId === activeUserId && accounts.length > 1}
						Another account will become active automatically.
					{/if}
				{:else}
					This will remove the selected account.
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={confirmDeleteAccount} class="bg-destructive text-destructive-foreground">
				Remove
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
