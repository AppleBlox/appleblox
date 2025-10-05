<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import ApplebloxIcon from '@/assets/appleblox.svg';
	import { events, os } from '@neutralinojs/lib';
	import { Activity, ChevronLeft, ChevronRight, ExternalLink, FileWarning, Rocket, Settings, Users } from 'lucide-svelte';
	import { quartInOut, quintOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import { loadSettings, saveSettings, setMultipleValues } from '../settings/files';

	export let onboardingLoaded = false;

	let loadedSettings = false;

	// Initialize onboarding state
	async function initOnboarding() {
		try {
			const settings = await loadSettings('onboarding_v2');
			if (settings?.show) {
				loadedSettings = true;
			} else if (settings?.show === false) {
				onboardingLoaded = true;
			} else {
				// First time - create onboarding settings
				await saveSettings('onboarding_v2', { show: true });
				loadedSettings = true;
			}
		} catch (error) {
			console.error('Failed to initialize onboarding:', error);
			// Fallback to showing onboarding
			loadedSettings = true;
		}
	}

	// Call initialization
	initOnboarding();

	let currentStep = 0;
	let showIcon = false;
	let animationPhase: 'icon' | 'content' = 'icon';

	interface OnboardingAction {
		type: 'switch' | 'button' | 'info';
		label: string;
		description?: string;
		value?: boolean;
		settingKey?: `${string}.${string}.${string}`;
		action?: () => void;
		variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
		icon?: any;
	}

	interface OnboardingStep {
		title: string;
		description: string;
		icon: any;
		content?: string;
		actions?: OnboardingAction[];
	}

	let steps: OnboardingStep[] = [
		{
			title: 'Welcome to AppleBlox',
			description: "Let's configure AppleBlox to match your preferences. This will only take a moment.",
			icon: Rocket,
		},
		{
			title: 'Activity Settings',
			description: 'Configure how AppleBlox connects to your activity.',
			icon: Activity,
			actions: [
				{
					type: 'switch',
					label: 'Server Location',
					description: 'Show your server location as a notification when joining a game.',
					value: true,
					settingKey: 'integrations.activity.notify_location',
				},
				{
					type: 'switch',
					label: 'Discord Rich Presence',
					description: 'Display your Roblox activity on Discord',
					value: true,
					settingKey: 'integrations.rpc.enabled',
				},
			],
		},
		{
			title: 'Behavior Settings',
			description: 'Define how AppleBlox interacts with Roblox.',
			icon: Settings,
			actions: [
				{
					type: 'switch',
					label: 'Delegate Launching',
					description: 'Launch AppleBlox before Roblox automatically (links & private server joining)',
					value: false,
					settingKey: 'roblox.behavior.delegate',
				},
				{
					type: 'switch',
					label: 'Disable Desktop App',
					description: 'Prevent Roblox desktop app from interfering',
					value: false,
					settingKey: 'roblox.behavior.disable_desktop_app',
				},
				{
					type: 'switch',
					label: 'Exit AppleBlox when Roblox closes',
					description: 'Automatically close AppleBlox when you quit Roblox',
					value: false,
					settingKey: 'roblox.behavior.close_on_exit',
				},
			],
		},
		{
			title: 'Join Our Community',
			description: 'Get help, share feedback, and stay updated with the latest AppleBlox news.',
			icon: Users,
			actions: [
				{
					type: 'button',
					label: 'Join Discord Server',
					description: 'Connect with other users and get support',
					variant: 'default',
					icon: ExternalLink,
					action: () => {
						os.open('https://appleblox.com/discord');
					},
				},
				// {
				// 	type: 'button',
				// 	label: 'View Documentation',
				// 	description: 'Learn more about AppleBlox features and troubleshooting',
				// 	variant: 'outline',
				// 	icon: BookOpen,
				// 	action: () => {
				// 		os.open('https://docs.appleblox.com');
				// 	},
				// },
			],
		},
		{
			title: 'Note: About recent "Fast flags" changes',
			description:
				"Roblox has implemented a whitelist system that restricts which fast flags can be modified. As a result, many engine settings (including frame rate caps, lighting technology, and others) are no longer configurable. Custom flag profiles may also be affected. Please do not create GitHub issues or Discord support threads about this limitation. It's a Roblox-side restriction that cannot (and shouldn't) be bypassed.",
			icon: FileWarning,
			actions: [],
		},
	];

	setTimeout(() => {
		showIcon = true;
		setTimeout(() => {
			animationPhase = 'content';
		}, 2500);
	}, 300);

	function nextStep() {
		if (currentStep < steps.length - 1) {
			currentStep++;
		} else {
			handleComplete();
		}
	}

	function prevStep() {
		if (currentStep > 0) {
			currentStep--;
		}
	}

	async function handleComplete() {
		try {
			// Collect all switch setting values
			const values: Array<{ path: `${string}.${string}.${string}`; value: any }> = [];

			for (const step of steps) {
				if (step.actions) {
					for (const action of step.actions) {
						if (action.type === 'switch' && action.settingKey && action.value !== undefined) {
							values.push({
								path: action.settingKey,
								value: action.value,
							});
						}
					}
				}
			}

			console.log('Saving settings:', values);

			// Save all settings atomically
			if (values.length > 0) {
				await setMultipleValues(values, true);
			}

			// Mark onboarding as complete
			await saveSettings('onboarding_v2', { show: false });

			// Update UI state
			onboardingLoaded = true;

			// Broadcast reload event
			try {
				events.broadcast('app:reload');
			} catch (error) {
				console.warn('Failed to broadcast reload event:', error);
			}
		} catch (error) {
			console.error('Failed to complete onboarding:', error);
			// Still allow onboarding to complete even if settings fail
			onboardingLoaded = true;
		}
	}

	function goToStep(step: number) {
		currentStep = step;
	}

	function handleSwitchChange(stepIndex: number, actionIndex: number, value: boolean) {
		if (!steps[stepIndex]?.actions?.[actionIndex]) {
			console.warn('Invalid step or action index:', stepIndex, actionIndex);
			return;
		}

		const action = steps[stepIndex].actions[actionIndex];
		if (action.type !== 'switch') {
			console.warn('Attempted to change non-switch action');
			return;
		}

		action.value = value;

		// Force reactivity by creating new array
		steps = [...steps];
	}

	// Get current step safely
	$: currentStepData = steps[currentStep];
	$: isLastStep = currentStep === steps.length - 1;
</script>

{#if loadedSettings}
	<div
		class="fixed inset-0 bg-gradient-to-br from-background via-background/95 to-muted/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden select-none"
	>
		<div class="w-full h-full max-w-6xl max-h-[90vh] mx-auto flex flex-col">
			{#if animationPhase === 'icon'}
				<div class="flex-1 flex items-center justify-center">
					{#if showIcon}
						<div
							class="relative animate-pulse"
							in:fly={{ y: -50, duration: 800, easing: quintOut }}
							out:fly={{ y: -100, duration: 600, easing: quintOut }}
						>
							<img src={ApplebloxIcon} class="h-64 md:h-80 lg:h-96 drop-shadow-2xl" alt="AppleBlox Logo" />
						</div>
					{/if}
				</div>
			{/if}

			{#if animationPhase === 'content'}
				<div
					class="flex-1 flex items-center min-h-0 overflow-hidden"
					in:fade={{ duration: 600, delay: 200, easing: quintOut }}
				>
					<div class="flex-1 flex items-center justify-center h-full">
						<div class="relative" in:fly={{ x: -100, duration: 800, delay: 400, easing: quintOut }}>
							<div
								class="w-48 h-48 md:w-64 md:h-64 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-border/30"
							>
								{#key currentStep}
									<div in:fly={{ y: 20, duration: 400, easing: quartInOut }}>
										{#if currentStepData?.icon}
											<svelte:component
												this={currentStepData.icon}
												class="w-24 h-24 md:w-32 md:h-32 text-primary"
											/>
										{/if}
									</div>
								{/key}
							</div>

							<div
								class="absolute -top-4 -right-4 w-8 h-8 bg-primary/30 rounded-full animate-bounce delay-75"
							></div>
							<div
								class="absolute -bottom-8 -left-8 w-6 h-6 bg-secondary/40 rounded-full animate-bounce delay-150"
							></div>
						</div>
					</div>

					<div class="flex-1 flex flex-col justify-center h-full max-h-[70vh] px-16">
						<div class="flex justify-center space-x-2 mb-8 flex-shrink-0">
							{#each steps as _, index}
								<button
									class="w-3 h-3 rounded-full transition-all duration-300 focus:outline-none select-none {index ===
									currentStep
										? 'bg-primary scale-110'
										: index < currentStep
											? 'bg-primary/60'
											: 'bg-muted'}"
									on:click={() => goToStep(index)}
								></button>
							{/each}
						</div>

						<div class="flex-1 flex flex-col justify-center max-h-full">
							{#if currentStepData}
								<div class="flex-shrink-0 mb-8 text-center">
									{#key currentStep}
										<div class="space-y-4" in:fly={{ x: 50, duration: 500, easing: quartInOut }}>
											<h1 class="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
												{currentStepData.title}
											</h1>
											<p
												class="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto"
											>
												{currentStepData.description}
											</p>
										</div>
									{/key}
								</div>

								{#if currentStepData.actions && currentStepData.actions.length > 0}
									<div
										class="overflow-y-auto overflow-x-hidden pr-2 max-h-[300px] scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent"
									>
										{#key currentStep}
											<div
												class="space-y-4 max-w-lg mx-auto"
												in:fly={{ x: 50, duration: 500, easing: quartInOut }}
											>
												{#each currentStepData.actions as action, index}
													<div
														class="p-4 bg-muted/20 rounded-lg border border-border/30 transition-all duration-200 hover:bg-muted/30"
														in:fly={{ y: 30, duration: 400, delay: index * 150, easing: quartInOut }}
													>
														{#if action.type === 'switch'}
															<div class="flex items-center justify-between">
																<div class="space-y-1 flex-1 mr-4">
																	<label class="text-sm font-medium text-foreground">
																		{action.label}
																	</label>
																	{#if action.description}
																		<p class="text-xs text-muted-foreground">
																			{action.description}
																		</p>
																	{/if}
																</div>
																<Switch
																	checked={action.value ?? false}
																	onCheckedChange={(checked) =>
																		handleSwitchChange(currentStep, index, checked)}
																/>
															</div>
														{:else if action.type === 'button'}
															<div class="space-y-3">
																<div class="space-y-1">
																	<h4 class="text-sm font-medium text-foreground">
																		{action.label}
																	</h4>
																	{#if action.description}
																		<p class="text-xs text-muted-foreground">
																			{action.description}
																		</p>
																	{/if}
																</div>
																<Button
																	variant={action.variant || 'outline'}
																	size="lg"
																	class="w-full justify-between text-sm focus:outline-none select-none group hover:scale-[1.02] transition-all duration-200"
																	on:click={action.action}
																>
																	<span class="flex items-center gap-2">
																		{action.label}
																	</span>
																	{#if action.icon}
																		<svelte:component
																			this={action.icon}
																			class="w-4 h-4 transition-transform group-hover:translate-x-1"
																		/>
																	{/if}
																</Button>
															</div>
														{:else if action.type === 'info'}
															<div class="space-y-1">
																<div class="flex items-center space-x-2">
																	<div class="w-2 h-2 bg-primary rounded-full"></div>
																	<h4 class="text-sm font-medium text-foreground">
																		{action.label}
																	</h4>
																</div>
																{#if action.description}
																	<p class="text-xs text-muted-foreground ml-4">
																		{action.description}
																	</p>
																{/if}
															</div>
														{/if}
													</div>
												{/each}
											</div>
										{/key}
									</div>
								{/if}
							{/if}
						</div>

						<div class="flex items-center justify-end mt-8 pt-6 border-t border-border/30 flex-shrink-0">
							<div class="flex items-center space-x-3">
								<!-- <Button
									variant="ghost"
									size="lg"
									on:click={handleComplete}
									class="flex items-center space-x-2 focus:outline-none select-none"
								>
									<span>Skip</span>
								</Button> -->

								{#if currentStep > 0}
									<Button
										variant="outline"
										size="lg"
										on:click={prevStep}
										class="min-w-[80px] focus:outline-none select-none space-x-2"
									>
										<ChevronLeft class="w-4 h-4" />
										<span>Previous</span>
									</Button>
								{/if}

								<Button
									size="lg"
									on:click={nextStep}
									class="flex items-center space-x-2 min-w-[100px] focus:outline-none select-none"
								>
									<span>
										{isLastStep ? 'Get Started' : 'Next'}
									</span>
									{#if isLastStep}
										<Rocket class="w-4 h-4" />
									{:else}
										<ChevronRight class="w-4 h-4" />
									{/if}
								</Button>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
