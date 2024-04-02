// Neutralino dev patch
// import "$lib/neu/init"

import './app.css'
import './ts/window'
import App from './App.svelte'
import { init } from "@neutralinojs/lib"

init()

const app = new App({
  // @ts-expect-error
  target: document.getElementById('app'),
})

export default app