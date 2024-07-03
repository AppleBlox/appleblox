import "./app.css";
import "./ts/window";
import "./ts/debugging";
import App from "./App.svelte";
import { events, init, os } from "@neutralinojs/lib";
import { version } from "../../../../package.json";
import { createRPC, getRPCAgentState } from "./ts/rpc";
import { libraryPath } from "./ts/lib.paths";
import { getMode } from "./ts/env";
import { loadSettings } from "./ts/settings";

init();

events.on("ready", async () => {
	setTimeout(async () => {
		console.log(
			`
      ===========
      AppleBlox v${version}
      Current Time: ${new Date().toLocaleString()}
      NeutralinoJS Version: ${window.NL_VERSION}
      ${(await os.execCommand("uname -a")).stdOut}===========
      `.replace(/  +/g, "")
		);

		// discordrpc
		if (!(await getRPCAgentState())) {
			const settings = await loadSettings("integrations");
			if (!settings) {
				console.log("No settings bruuu");
				return;
			}
			if (!settings.rpc.enable_rpc) return;
			await createRPC({
				details: "Browsing the menus",
				state: "Beta",
				large_image: "appleblox",
				large_image_text: "AppleBlox Logo",
			});
		}

		// launch the process manager that will kill the subprocesses if AppleBlox is closed (prevents memory leaks)
		const procCmd = `${libraryPath("process_manager")}`;
		console.log(procCmd);
		const procMonitor = await os.spawnProcess(procCmd);

		events.on("spawnedProcess", (e) => {
			if (e.detail.id === procMonitor.id) {
				console.log(e.detail.action);
				switch (e.detail.action) {
					case "stdOut":
					case "stdErr":
						console.log("[PROM] " + e.detail.data);
				}
			}
		});

		setInterval(async () => {
			await os.updateSpawnedProcess(procMonitor.id, "stdIn", "Alive");
			// await os.updateSpawnedProcess(procMonitor.id, "stdInEnd");
		}, 500);
	}, 500);
});

const app = new App({
	// @ts-expect-error
	target: document.getElementById("app"),
});

export default app;
