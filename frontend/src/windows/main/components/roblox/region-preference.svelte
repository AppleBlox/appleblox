<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Card from '$lib/components/ui/card/index';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { Badge } from '$lib/components/ui/badge';
	import { getValue, setValue } from '../../components/settings';
	import { hasRobloxCookie } from '../../ts/roblox/accounts';
	import { AVAILABLE_REGIONS } from '../../ts/roblox/rovalra-api';
	import Logger from '@/windows/main/ts/utils/logger';
	import { Globe, Info, Shield, MapPin } from 'lucide-svelte';

	const logger = Logger.withContext('RegionPreference');
	const dispatch = createEventDispatcher();

	const SETTINGS_ENABLED = 'region.preferences.enabled';
	const SETTINGS_REGION = 'region.preferences.preferred_region';
	const SETTINGS_CONSENT = 'region.preferences.contribution_consent';

	let isLoading = true;
	let isEnabled = false;
	let selectedRegion = 'AUTO';
	let contributionConsent = false;
	let hasAccount = false;
	let showConsentDialog = false;
	let pendingEnable = false;

	onMount(async () => {
		await loadSettings();
	});

	async function loadSettings() {
		isLoading = true;
		try {
			// Use try-catch for each getValue since settings may not exist yet
			try {
				isEnabled = (await getValue<boolean>(SETTINGS_ENABLED)) === true;
			} catch {
				isEnabled = false;
			}

			try {
				selectedRegion = (await getValue<string>(SETTINGS_REGION)) || 'AUTO';
			} catch {
				selectedRegion = 'AUTO';
			}

			try {
				contributionConsent = (await getValue<boolean>(SETTINGS_CONSENT)) === true;
			} catch {
				contributionConsent = false;
			}

			hasAccount = await hasRobloxCookie();
		} catch (err) {
			logger.error('Failed to load region settings:', err);
		}
		isLoading = false;
	}

	async function handleEnableToggle(enabled: boolean) {
		if (enabled && !hasAccount) {
			toast.warning('Please connect your Roblox account first');
			return;
		}

		if (enabled && !contributionConsent) {
			pendingEnable = true;
			showConsentDialog = true;
			return;
		}

		isEnabled = enabled;
		await setValue(SETTINGS_ENABLED, enabled, true);
		dispatch('change', { enabled, region: selectedRegion });
	}

	async function handleRegionChange(value: string) {
		selectedRegion = value;
		await setValue(SETTINGS_REGION, value, true);
		dispatch('change', { enabled: isEnabled, region: selectedRegion });
	}

	async function handleConsentAccept() {
		contributionConsent = true;
		await setValue(SETTINGS_CONSENT, true, true);
		showConsentDialog = false;

		if (pendingEnable) {
			pendingEnable = false;
			if (hasAccount) {
				isEnabled = true;
				await setValue(SETTINGS_ENABLED, true, true);
				toast.success('Region selection enabled');
				dispatch('change', { enabled: isEnabled, region: selectedRegion });
			} else {
				toast.warning('Please connect your Roblox account to enable region selection');
			}
		}
	}

	function handleConsentDecline() {
		showConsentDialog = false;
		pendingEnable = false;
	}

	// React to account changes from cookie-setup component
	export function onAccountChange(authenticated: boolean) {
		hasAccount = authenticated;
		if (!authenticated && isEnabled) {
			isEnabled = false;
			setValue(SETTINGS_ENABLED, false, true);
		}
	}
</script>

<Card.Root class="border-border/50">
	<Card.Header class="pb-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Globe class="w-5 h-5 text-muted-foreground" />
				<Card.Title class="text-base">Preferred Region</Card.Title>
			</div>
			{#if isEnabled}
				<Badge variant="default" class="bg-primary/20 text-primary hover:bg-primary/30">Active</Badge>
			{:else}
				<Badge variant="secondary">Disabled</Badge>
			{/if}
		</div>
		<Card.Description>Join servers in your preferred geographic region for better ping and performance.</Card.Description>
	</Card.Header>

	<Card.Content class="space-y-4">
		{#if isLoading}
			<div class="flex items-center justify-center py-4">
				<div class="w-5 h-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
			</div>
		{:else}
			<!-- Enable Toggle -->
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<label for="region-enabled" class="text-sm font-medium"> Enable Region Selection </label>
					<p class="text-xs text-muted-foreground">
						{#if !hasAccount}
							Requires Roblox account connection
						{:else if !contributionConsent}
							Click to review data contribution requirements
						{:else}
							Find and join servers in your preferred region
						{/if}
					</p>
				</div>
				<Switch id="region-enabled" checked={isEnabled} disabled={!hasAccount} onCheckedChange={handleEnableToggle} />
			</div>

			<!-- Region Selector -->
			<div class="space-y-2">
				<label for="region-select" class="text-sm font-medium">Preferred Region</label>
				<Select.Root
					disabled={!isEnabled}
					selected={{
						value: selectedRegion,
						label: AVAILABLE_REGIONS.find((r) => r.value === selectedRegion)?.label || selectedRegion,
					}}
					onSelectedChange={(selected) => selected && handleRegionChange(selected.value)}
				>
					<Select.Trigger id="region-select" class="w-full">
						<Select.Value placeholder="Select a region" />
					</Select.Trigger>
					<Select.Content>
						{#each AVAILABLE_REGIONS as region}
							<Select.Item value={region.value}>
								<div class="flex items-center gap-2">
									<MapPin class="w-3 h-3 text-muted-foreground" />
									{region.label}
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<p class="text-xs text-muted-foreground">
					{#if selectedRegion === 'AUTO'}
						Roblox will automatically select the best server
					{:else}
						AppleBlox will find servers in this region before joining
					{/if}
				</p>
			</div>

			<!-- Data Contribution Info -->
			{#if !contributionConsent}
				<button
					on:click={() => (showConsentDialog = true)}
					class="w-full p-3 rounded-lg border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
				>
					<div class="flex items-start gap-2">
						<Shield class="w-4 h-4 text-muted-foreground mt-0.5" />
						<div>
							<p class="text-sm font-medium">Data Contribution Required</p>
							<p class="text-xs text-muted-foreground mt-0.5">
								Click to learn about and accept data sharing requirements
							</p>
						</div>
					</div>
				</button>
			{:else}
				<div class="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
					<Info class="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
					<p class="text-xs text-muted-foreground">
						This feature uses RoValra's server database. In exchange, AppleBlox contributes anonymous server data
						(server IDs and regions only - no personal info).
					</p>
				</div>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>

<!-- Data Contribution Consent Dialog -->
<AlertDialog.Root bind:open={showConsentDialog}>
	<AlertDialog.Content class="max-w-lg">
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				<Shield class="w-5 h-5 text-primary" />
				Data Contribution Agreement
			</AlertDialog.Title>
			<AlertDialog.Description class="text-left space-y-4">
				<p>
					The region selection feature uses <strong>RoValra's datacenter database</strong> to map servers to geographic locations.
				</p>

				<p>
					To use this database fairly, AppleBlox will contribute anonymous server data back to help keep the database
					accurate.
				</p>

				<div class="bg-muted rounded-lg p-4 space-y-2">
					<p class="font-medium text-sm">What AppleBlox sends:</p>
					<ul class="text-sm text-muted-foreground space-y-1 list-disc list-inside">
						<li>Server IDs you encounter</li>
						<li>Place IDs of games you join</li>
						<li>Datacenter IDs (region information)</li>
					</ul>
				</div>

				<div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-2">
					<p class="font-medium text-sm text-green-600">What is NEVER sent:</p>
					<ul class="text-sm text-muted-foreground space-y-1 list-disc list-inside">
						<li>Your Roblox cookie or password</li>
						<li>Your user ID or username</li>
						<li>Any personal information</li>
					</ul>
				</div>
			</AlertDialog.Description>
		</AlertDialog.Header>

		<AlertDialog.Footer>
			<AlertDialog.Cancel on:click={handleConsentDecline}>Decline</AlertDialog.Cancel>
			<Button on:click={handleConsentAccept}>I Agree & Enable</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
