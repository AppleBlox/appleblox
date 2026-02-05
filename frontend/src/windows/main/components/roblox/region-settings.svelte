<script lang="ts">
	import CookieSetup from './cookie-setup.svelte';
	import RegionPreference from './region-preference.svelte';

	let regionPreferenceRef: RegionPreference;

	function handleAccountChange(event: CustomEvent<{ authenticated: boolean }>) {
		if (regionPreferenceRef) {
			regionPreferenceRef.onAccountChange(event.detail.authenticated);
		}
	}
</script>

<div class="space-y-4">
	<CookieSetup on:change={handleAccountChange} />
	<RegionPreference bind:this={regionPreferenceRef} />
</div>
