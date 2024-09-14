<script lang="ts">
	import {
		loadSettings,
		saveSettings,
		type Category,
		type PanelWidget,
		type SelectElement,
		type SettingsOutput,
		type SettingsPanel,
	} from '.';

	import * as Card from "$lib/components/ui/card/index.js";
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import LoadingSpinner from '../../util/LoadingSpinner.svelte';
	import { createEventDispatcher } from 'svelte';

	import ButtonWidget from './widgets/button.svelte';
	import FilepickerWidget from './widgets/filepicker.svelte';
	import InputWidget from './widgets/input.svelte';
	import SelectWidget from './widgets/select.svelte';
	import SliderWidget from './widgets/slider.svelte';
	import SwitchWidget from './widgets/switch.svelte';

	// Panel props
	export let panel: SettingsPanel;
	export let autosave = true;

	// Load settings
	let settingsLoaded = false;
	// Svelte doesn't support typescript in components so we can't use this type (no inferring)
	let settings: { [key: string]: { [key: string]: any } } /* SettingsOutput*/ = {};

	// Set default values for the settings
	for (const category of panel.categories) {
		settings[category.id] = {};
		for (const widget of category.widgets) {
			switch (widget.options.type) {
				case 'input':
				case 'switch':
				case 'slider':
					settings[category.id][widget.id] = widget.options.default;
					break;
				case 'filepicker':
					settings[category.id][widget.id] = null;
					break;
				case 'select':
					const defaultItemValue = widget.options.default;
					settings[category.id][widget.id] = widget.options.items.find((item) => item.value === defaultItemValue);
					break;
			}
		}
	}

	// Load settings if they exist
	(async () => {
		// Load saved settings and make sure they match across versions
		const currentSettings = await loadSettings(panel.id);
		let saveNewPanel = false;
		if (currentSettings) {
			// Update default value
			for (const category of panel.categories) {
				// Skip category if it changed
				if (!currentSettings[category.id]) {
					console.warn(`Skipped category ${panel.id}.${category.id} as it doesn't exist anymore.`);
					saveNewPanel = true;
					continue;
				}
				for (const widget of category.widgets) {
					switch (widget.options.type) {
						case 'filepicker':
							if (!widget.options.default) {
								settings[category.id][widget.id] = currentSettings[category.id][widget.id];
								break;
							}
						case 'input':
						case 'select':
						case 'switch':
						case 'slider':
							// console.debug(`(${widget.id}) => ${widget.options.default}: ${typeof widget.options.default} | ${currentSettings[category.id][widget.id]}: ${typeof currentSettings[category.id][widget.id]}`)
							if (
								typeof widget.options.default === typeof currentSettings[category.id][widget.id] ||
								typeof widget.options.default === typeof currentSettings[category.id][widget.id]?.value
							) {
								settings[category.id][widget.id] = currentSettings[category.id][widget.id];
							} else {
								console.warn(
									`Value type has changed for ${panel.id}.${category.id}.${widget.id}. Fallback to default.`
								);
								saveNewPanel = true;
							}
							break;
					}
				}
			}
			if (saveNewPanel) {
				console.warn('Detected panel changes, saving fixed panel');
				updateSettings();
			}
		}
		// Show the page
		settingsLoaded = true;
	})();

	const dispatch = createEventDispatcher<{
		/** Fires when the settings change */
		changed: { settings: SettingsOutput };
		/** Fires when a button is clicked */
		button: { id: string };
		/** Fires when a switch is clicked */
		switch: { id: string; state: boolean };
		/** Fires when a file is chosen from a filepicker */
		fileChosen: { id: string; file: string };
		/** Fires when a file is removed from a filepicker */
		fileRemoved: null;
		/** Fires when an input changes */
		input: { input: string };
		/** Fires when a select item is chosen */
		selected: { id: string; item: SelectElement };
		/** Fires when a slider changes */
		slider: { id: string; value: number[] };
	}>();

	/** Saves the new settings */
	async function updateSettings() {
		settings = settings;
		if (autosave) {
			await saveSettings(panel.id, settings);
		}
		dispatch('changed', { settings });
	}

	/** Checks if the widget is in toggled state */
	function isToggled(category: Category, widget: PanelWidget, _reactive: any) {
		if (!widget.toggleable) return true;
		const targetWidget = settings[category.id][widget.toggleable.id];
		// console.log(widget.options.type,widget.toggleable.value,targetWidget.value)
		switch (widget.toggleable.type) {
			case 'filepicker':
			case 'switch':
			case 'input':
				return widget.toggleable.value === targetWidget;
			case 'select':
				return widget.toggleable.value === targetWidget.value;
			case 'slider':
				return widget.toggleable.value[0] === targetWidget[0];
		}
		return false;
	}
</script>

{#if settingsLoaded}
	<div class="font-mono grid grid-cols-1 h-full text-start m-5">
		<!-- Title + Description -->
		<div class="bg-[#d7d7d7] dark:bg-gray-900 grayscale p-4 rounded-md">
			<p class="text-3xl font-bold text-black dark:text-white">{panel.name}</p>
			<p class="text-[13px] text-neutral-700 dark:text-neutral-300">
				{@html panel.description}
			</p>
		</div>
		<!-- Categories -->
		{#each panel.categories || [] as category (category.id)}
			<div class="mt-5">
				<!-- Category Description -->
				<p class="text-xl font-bold text-red-600 dark:text-red-400">{category.name}</p>
				<p class="text-[13px] text-black dark:text-neutral-50">{category.description}</p>
				{#each category.widgets || [] as widget (widget.id)}
					<!-- Separator for the widgets (except button) -->
					{#if widget.options.type !== 'button'}
						<Separator class="my-3 bg-gray-300 opacity-25" el={undefined} decorative={true} />
					{/if}
					<!-- Disable the widget if the button it is linked to is disabled -->
					<div
						class={`flex items-center w-full duration-200 ${isToggled(category, widget, widget.toggleable ? settings[category.id][widget.toggleable.id] : null) ? '' : 'grayscale cursor-not-allowed opacity-60 select-one pointer-events-none'}`}
					>
						<!-- Description of the widget (except button) -->
						{#if widget.options.type !== 'button'}
							<div class={widget.options.type === 'slider' ? 'w-[500px]' : ''}>
								<p class="font-semibold text-[#1f1717] dark:text-red-100">
									{widget.label}
								</p>
								<p class="text-[13px] text-neutral-700 dark:text-neutral-200">
									{@html widget.description}
								</p>
							</div>
						{/if}

						<!-- Button widget -->
						{#if widget.options.type == 'button'}
							<ButtonWidget
								label={widget.label}
								description={widget.description}
								variant={widget.options.variant}
								icon={widget.options.icon || null}
							/>
							<!-- Switch Widget -->
						{:else if widget.options.type === 'switch'}
							<SwitchWidget
								defaultValue={settings[category.id][widget.id]}
								on:clicked={(e) => {
									const { state } = e.detail;
									settings[category.id][widget.id] = state;
									dispatch('switch', { id: widget.id, state });
									updateSettings();
								}}
							/>
							<!-- Input widget -->
						{:else if widget.options.type === 'input'}
							<div class="flex flex-1 justify-end">
								<InputWidget
									defaultValue={settings[category.id][widget.id]}
									placeholder={widget.options.default}
									whitelist={widget.options.whitelist}
									blacklist={widget.options.blacklist}
									on:inputChanged={(e) => {
										const { input } = e.detail;
										settings[category.id][widget.id] = input;
										dispatch('input', { input });
										updateSettings();
									}}
								/>
							</div>
							<!-- Filepicker widget -->
						{:else if widget.options.type === 'filepicker'}
							<FilepickerWidget
								file={settings[category.id][widget.id]}
								extensions={widget.options.extensions || null}
								on:fileChosen={(e) => {
									const filePath = e.detail.path;
									settings[category.id][widget.id] = filePath;
									dispatch('fileChosen', { id: widget.id, file: filePath });
									updateSettings();
								}}
								on:fileRemoved={() => {
									settings[category.id][widget.id] = null;
									dispatch('fileRemoved');
									updateSettings();
								}}
							/>
							<!-- Dropdown Widget -->
						{:else if widget.options.type === 'select'}
							<SelectWidget
								items={widget.options.items}
								defaultItem={settings[category.id][widget.id]}
								on:itemSelected={(e) => {
									const { item } = e.detail;
									settings[category.id][widget.id] = item;
									dispatch('selected', { id: widget.id, item });
									updateSettings();
								}}
							/>
							<!-- Slider widget -->
						{:else if widget.options.type === 'slider'}
							<SliderWidget
								placeholderValue={widget.options.default}
								defaultValue={settings[category.id][widget.id]}
								max={widget.options.max}
								min={widget.options.min}
								step={widget.options.step}
								on:changed={(e) => {
									const { value } = e.detail;
									settings[category.id][widget.id] = value;
									dispatch('slider', { id: widget.id, value });
									updateSettings();
								}}
							/>
							<!-- Custom widgets (Double Buttons & ModsUI) -->
						{:else if widget.options.type === 'custom'}
							<svelte:component this={widget.options.component} />
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
{:else}
	<div class="flex h-[100vh] w-full opacity-30 grayscale items-center justify-center">
		<LoadingSpinner />
	</div>
{/if}
