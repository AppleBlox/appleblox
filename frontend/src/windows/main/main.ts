import "./app.css";
import "./ts/window";
import "./ts/debugging";
import App from "./App.svelte";
import { events, init, os } from "@neutralinojs/lib";
import { version } from "../../../../package.json";
import { createRPC } from "./ts/rpc";
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

		// launch the process manager that will kill the subprocesses if AppleBlox is closed (prevents memory leaks)
    const procCmd = `${libraryPath("process_manager")} ${getMode() === "dev" ? "--dev" : ""}`;
    const procMonitor = await os.spawnProcess(procCmd)
	}, 500);
});

const app = new App({
	// @ts-expect-error
	target: document.getElementById("app"),
});

export default app;
