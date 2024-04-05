// Neutralino dev patch
// import "$lib/neu/init"

import './app.css'
import './ts/window'
import App from './App.svelte'
import { init } from "@neutralinojs/lib"
import Integrations from "./pages/Integrations.svelte"

init()

const app = new App({
  // @ts-expect-error
  target: document.getElementById('app'),
})

export default app