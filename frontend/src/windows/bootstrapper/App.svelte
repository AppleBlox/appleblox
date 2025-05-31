<script lang="ts">
	import { events, init as neuInit } from '@neutralinojs/lib';
	import { onMount } from 'svelte';
	import { Progress } from '@/lib/components/ui/progress';
    import Logo from '@/assets/favicon.png';
	import { mode, ModeWatcher, setMode } from 'mode-watcher';

	let progress = 0;
	let text = 'Initializing...';

    setMode('system');

	onMount(async () => {
        try {
            neuInit();
        } catch (e) {
            console.error("Bootstrapper: Neutralino init failed:", e);
            text = "Error: Could not connect to AppleBlox services.";
            progress = 0;
            return;
        }
        
		events.on('bootstrapper:progress', (evt: CustomEvent) => {
			if (evt && evt.detail && typeof evt.detail.progress === 'number') {
				progress = evt.detail.progress;
			}
		});
		events.on('bootstrapper:text', (evt: CustomEvent) => {
			if (evt && evt.detail && typeof evt.detail.text === 'string') {
				text = evt.detail.text;
			}
		});

		events.on('bootstrapper:close', async () => {
            console.log("Bootstrapper received close event. Main process should terminate the viewer.");
		});

        try {
            await events.dispatch("bootstrapper:ready", { windowId: window.NL_PID });
            console.log("Bootstrapper: Dispatched ready event.");
        } catch(e) {
            console.error("Bootstrapper: Failed to dispatch bootstrapper:ready", e);
        }
	});
</script>

<ModeWatcher />
<div 
    class="flex flex-col items-center justify-center h-screen w-screen transition-opacity duration-500 ease-in-out select-none"
>
    <div class="relative z-10 text-center w-full h-full flex flex-col items-center justify-center px-[8vw] py-[6vh]">
        <img 
            src={Logo}
            alt="AppleBlox Logo" 
            class="w-[28vmin] h-[28vmin] mx-auto mb-[4vh] object-contain" 
            id="launch_logo"
        />

        <h1 
            class="text-[5vmin] font-semibold mb-[4vh] text-foreground leading-tight tracking-wide max-w-full" 
            id="launch_text"
        >
            {text}
        </h1>
        
        <div class="mb-[3vh] w-full">
            <Progress 
                value={progress} 
                max={100} 
                class="w-full h-[2vmin] min-h-[12px] max-h-[24px] [&>div]:bg-primary [&>div]:transition-all [&>div]:duration-300" 
                id="launch_progress" 
            />
        </div>
        
        <p class="text-[3vmin] text-foreground/70 font-medium tracking-wider mb-[2vh]">
            AppleBlox Bootstrapper
        </p>
        
        <p class="text-[2.5vmin] text-foreground/50 font-mono">
            {Math.round(progress)}%
        </p>
    </div>
</div>