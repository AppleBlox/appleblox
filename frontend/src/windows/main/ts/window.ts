import { events, app, debug } from "@neutralinojs/lib";
import hotkeys from "hotkeys-js";
events.on("windowClose",() => {
    app.exit(0).catch(console.error)
}).catch(console.error).then(()=>{
    debug.log("Attached window closer").catch(console.error)
})

hotkeys("ctrl+c,cmd+c", (e)=>{
    e.preventDefault()
    document.execCommand("copy")
})

hotkeys("ctrl+v,cmd+v", (e)=>{
    e.preventDefault()
    document.execCommand("paste")
})

hotkeys("ctrl+x,cmd+x", (e)=>{
    e.preventDefault()
    document.execCommand("copy")
    document.execCommand("cut")
})

hotkeys("ctrl+z,cmd+z", (e)=>{
    e.preventDefault()
    document.execCommand("undo")
})

hotkeys("cmd+q,cmd+w", (e)=>{
    e.preventDefault()
    app.exit(0)
})

hotkeys("ctrl+a,cmd+a", (e)=>{
    e.preventDefault()
    document.execCommand("selectAll")
})