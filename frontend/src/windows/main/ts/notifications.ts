import { debug, events, os, window as w } from "@neutralinojs/lib"
import { libraryPath } from "./lib.paths";
import { focusWindow } from "./window";

export interface NotificationOptions {
    title: string,
    content: string,
    group?: string,
    sound?: boolean,
    timeout?: number,
    type?: os.Icon,
}

export function showNotification(options: NotificationOptions) {
    try {
        const alerter = libraryPath("notifications")
        const cmd = `${alerter} -message "${options.content}" -title "${options.title}" ${options.group ? `-group "${options.group}"`: ""} -sender "Br" ${options.timeout ? '-timeout ' + Math.floor(options.timeout) : ''} ${options.sound ? '-sound default' : ''}`
        os.spawnProcess(cmd)
    } catch (err) {
        console.error(err)
    }
}

events.on("spawnedProcess",(evt)=>{
    if (evt.detail.action === "stdOut") {
        if (evt.detail.data === "@ACTIONCLICKED") {
            focusWindow()
        }
    }
})