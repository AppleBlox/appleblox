<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card/index';
	import { Switch } from '$lib/components/ui/switch';
	import { ShieldCheck } from 'lucide-svelte';
	import { getValue, setValue } from '../../components/settings';
	import CookieSetup from './cookie-setup.svelte';
	import RegionPreference from './region-preference.svelte';

	const SETTINGS_KEY = 'account.features.enabled';
	let enabled = false;
	let loaded = false;

	let regionPreferenceRef: RegionPreference;

	onMount(async () => {
		try {
			enabled = (await getValue<boolean>(SETTINGS_KEY)) === true;
		} catch {
			enabled = false;
		}
		loaded = true;
	});

	async function toggle(checked: boolean) {
		enabled = checked;
		await setValue(SETTINGS_KEY, checked, true);
	}

	function handleAccountChange(event: CustomEvent<{ authenticated: boolean }>) {
		if (regionPreferenceRef) {
			regionPreferenceRef.onAccountChange(event.detail.authenticated);
		}
	}
</script>

{#if loaded}
	<div class="space-y-4">
		<Card.Root class="border-border/50">
			<Card.Header class="pb-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<ShieldCheck class="w-5 h-5 text-muted-foreground" />
						<Card.Title class="text-base">Account Features</Card.Title>
					</div>
					<Switch checked={enabled} onCheckedChange={toggle} />
				</div>
				<Card.Description>
					Enable account management and region selection. Requires connecting your Roblox account.
				</Card.Description>
			</Card.Header>
		</Card.Root>

		{#if enabled}
			<CookieSetup on:change={handleAccountChange} />
			<RegionPreference bind:this={regionPreferenceRef} />
		{/if}
	</div>
{/if}
