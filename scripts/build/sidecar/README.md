# Sidecar

These scripts are used for native operations and are invoked from neutralino. Most of them are made using assistance from AI due to the lack of native contributors (skill issue on my part).

## Bootstrap

Launches the `main` executable with these arguments:
```
--path=<app Resources folder>
--enable-extensions=true"
--window-enable-inspector=true
```

It also captures if the app was launched using a deeplink, in which case it will either, launch the app, or re-launch the main executable if it is already open. The bootstrap will exit once the main executable exits.

## Rlogs (Roblox Logs)

This is just a simple file watcher, that returns new changes (lines) to stdOut as arrays.

When *rlogs* needs to output a message, it will be prefixed with: `message:`. Every 5 minutes, it checks if the log file size changed, if it did, it should check for the new content it potentially missed, and unwatch + rewatch the file.

## UrlScheme

Utility CLI to change the default handler for an URI (LSHandler). Used to open AppleBlox from the website.

## Window Manager

Takes **stdIn** like this format:
```json
[{"appName": "Roblox", "x": 0, "y": 100, "w": 40, "h": 80}]
```
The array can contain any number of objects. The script will move the *first* window it finds of the specified app accordingly. In the frontend to be able to talk with this process easily, we create a pipe using `mkfifo` at `/tmp/window_relay_ablox`, then use the `echo` command to pass the stdIn. To be able to take input from the pipe, we start the window manager like this:

```bash
./window_manager <> pipe_path
```

Please note that the **window manager** currently only has 1 use case and that is the rythm game `Project: Afternight`. In the future we may use it more.