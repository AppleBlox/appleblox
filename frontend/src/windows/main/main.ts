// Neutralino dev patch
// import "$lib/neu/init"

import "./app.css";
import "./ts/window";
import "./ts/debugging";
import App from "./App.svelte";
import { events, init, os } from "@neutralinojs/lib";
import Integrations from "./pages/Integrations.svelte";
import { version } from "../../../../package.json";

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
      `.replace(/  +/g, '')
		);
	}, 500);
});

const app = new App({
	// @ts-expect-error
	target: document.getElementById("app"),
});

export default app;
