<script lang="ts">
	import type { SettingsPanel } from "@/types/settings";
	import Panel from "./Settings/Panel.svelte";
	import { saveSettings } from "../ts/settings";
	import { showNotification } from "../ts/notifications";
	import { toast } from "svelte-sonner";
	import { isRobloxOpen } from "../ts/roblox";
	import { events, os } from "@neutralinojs/lib";
	import { sleep } from "$lib/appleblox";

	function settingsChanged(o: Object) {
		saveSettings("misc", o);
	}

	let robloxProcessIds: number[] = [];
	let processingIds: number[] = [];
	events.on("spawnedProcess", async (e) => {
		if (robloxProcessIds.includes(e.detail.id)) {
			switch (e.detail.action) {
				case "stdErr":
				case "stdOut":
					if (processingIds.includes(e.detail.id)) return;
					processingIds.push(e.detail.id);
					await sleep(1000);
					toast.info("Terminating every Roblox processes...");
					await os.execCommand(`ps aux | grep -i roblox | grep -v grep | awk '{print $2}' | xargs kill -9`);
					break;
				case "exit":
					robloxProcessIds = robloxProcessIds.filter((id) => id !== e.detail.id);
					toast.success("Multi-Instances should be active.");
					break;
			}
		}
	});
	async function buttonClicked(e: CustomEvent) {
		const id = e.detail;
		switch (id) {
			case "multi_roblox_btn":
				if (!(await isRobloxOpen())) {
					toast.info("Closing Roblox...", { duration: 1000 });
					await os.execCommand(`pkill -9 Roblox`);

					await sleep(1000);

					toast.info("Opening Roblox...", { duration: 1000 });
					const proc = await os.spawnProcess("/Applications/Roblox.app/Contents/MacOS/RobloxPlayer");
					robloxProcessIds.push(proc.id);
				}
				break;
			case "open_instance_btn":
				os.spawnProcess("/Applications/Roblox.app/Contents/MacOS/RobloxPlayer; exit");
				break;
			case "close_roblox_btn":
				await os.execCommand(`ps aux | grep -i roblox | grep -v grep | awk '{print $2}' | xargs kill -9`);
				toast.success("All Roblox Instances have been closed.");
				break;
		}
	}

	const panelOpts: SettingsPanel = {
		name: "Misc",
		description: "Various miscellaneous features and options",
		id: "misc",
		sections: [
			{
				name: "Multi Instances",
				description: "Makes it so multiple Roblox windows can be opnened at once.",
				id: "multi_instances",
				interactables: [
					{
						label: "Enable Multi Instances",
						description: "Makes it so multiple Roblox windows can be opnened at once.",
						id: "multi_roblox_btn",
						options: {
							type: "button",
							style: "default",
						},
					},
					{
						label: "Open Instance",
						description: "Opens an instance of the Roblox app. (Achieves the same goal as opening from the web)",
						id: "open_instance_btn",
						options: {
							type: "button",
							style: "secondary",
						},
					},
					{
						label: "Terminate all instances",
						description: "Closes every open Roblox instances. (This acts as a force-kill, so be sure to use this appropriately)",
						id: "close_roblox_btn",
						options: {
							type: "button",
							style: "destructive",
						},
					},
				],
			},
		],
	};
</script>

<Panel
	panel={panelOpts}
	on:buttonClicked={buttonClicked}
	on:settingsChanged={(e) => {
		settingsChanged(e.detail);
	}}
/>
