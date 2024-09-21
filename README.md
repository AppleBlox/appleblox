<div align="center">
    <img src=".github/assets/logo.png" style="width:30%;">
</div>

---

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/AppleBlox/appleblox/build.yml?color=%23F43F5E)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/AppleBlox/appleblox/total?color=%23F43F5E)
![GitHub License](https://img.shields.io/github/license/AppleBlox/appleblox?color=%23F43F5E)
![GitHub package.json version](https://img.shields.io/github/package-json/v/AppleBlox/appleblox?color=%23F43F5E)
![Static Badge](https://img.shields.io/badge/built_with_apples-%23F43F5E)
[![Discord](https://img.shields.io/discord/1263512148450082837?logo=discord&logoColor=white&label=discord&color=4d3dff)](https://discord.gg/MWHgn8VNZT)

# AppleBlox

AppleBlox is a simple Roblox launcher for **MacOS**, heavily inspired by [Bloxstrap](https://github.com/pizzaboxer/bloxstrap).
Supports DiscordRPC, Fast-flags & more to come.

You can get a demo of the app from the [Releases](https://github.com/AppleBlox/appleblox/releases/latest)

For more recent builds, see the [nightly releases](https://nightly.link/AppleBlox/appleblox/workflows/build/main?preview)

# Features

### Mods

You can add mods to tweak Roblox's UI via the `~Library/AppleBlox/Mods` folder (there is a button in the app to open it). To do so, simply drag a Mod folder into this location. Exemple:

![CleanShot 2024-07-17 at 22 46 42@2x](https://github.com/user-attachments/assets/587330fe-9f50-4349-9379-794853b28527)

Then, from AppleBlox, you can choose to enable / disable mods globally or individually. Please note that mods are loaded in alphabetical order (123,abc).

### DiscordRPC

Show which games you're playing, when you started, and supports buttons to join your server. If the Bloxstrap SDK settings has been enabled, games will be able to set custom rich presence.

### Bloxstrap SDK

AppleBlox supports many features from Bloxstrap including [the sdk](https://github.com/pizzaboxer/bloxstrap/wiki/Integrating-Bloxstrap-functionality-into-your-game). This let's games set custom **discord rich presence**, and with our addons, much more like control the Roblox window ([see this exemple for a rythm game](https://streamable.com/jwidvp?t=55)).

### Server notifications

When joining a server, you will be notified of its location. (Exemple: Paris, Île-de-France, FR)

### FastFlags

Use a collection of presets to spice-up your gameplay & add your owns.

### Multi-instances

Launch multiple windows of Roblox at the same time. Please note that AppleBlox only tracks data of **1** window, launched from the main menu.

## Pre-compiled Binaries

AppleBlox contains pre-compiled binaries of some programs at `build/lib/MacOS` from:

-   https://github.com/vjeantet/alerter (Taken from the github releases)
-   https://github.com/Rayrsn/Discord-RPC-cli (Built from source on my machine)
-   https://github.com/OrigamingWasTaken/utility_cli (Built from source on my machine)

I plan on modifying this to compile those binaries at build step, but that would mean having to install Rust and Xcode, so I'm not really sure...
If you're worried that those could be modified by me or another contributor to include malicious code, you can look at the "VirusTotal Scan" GitHub workflow. This workflow scans the release assets for malicious code.

## Developpement

To setup the app on your machine, clone this repo and run `bun install`. You will also need to install some packages with the command: `brew install create-dmg`.

To start the **dev environnement**, run `bun run --bun dev`.

To **package**, run `bun run --bun package`. (If you don't want to create dmgs)

To **package and create a dmg of the app**, run `bun run --bun release`.

The app is made with [Svelte](https://svelte.dev) (Frontend) and [NeutralinoJS](https://neutralino.js.org) (Backend).
If you haven't heard about NeutralinoJS, it is a lightweight alternative coded in **c++** to frameworks like Electron or NW.JS. It is still growing, but is stable enough to be used on one platform. You can learn more about it on https://neutralino.js.org/docs.

## Contributing

All contributions are welcome! Feel free to open issues and pull requests. For further discussion, contact me at `contact@origaming.ch` or on discord `@Origaming`.

## Gallery

<div float="left">
    <img src=".github/assets/src1.png" style="width:45%;">
    <img src=".github/assets/src2.png" style="width:45%;">
    <img src=".github/assets/src3.png" style="width:45%;">
    <img src=".github/assets/src4.png" style="width:45%;">
    <img src=".github/assets/src7.png" style="width:45%;">
    <img src=".github/assets/src5.png" style="width:45%;">
    <img src=".github/assets/src6.png" style="width:35%;">
</div>

## Credits

-   Logo by @typeofnull
-   Inspired from @pizzaboxer's Bloxstrap
-   Icons by lucide-svelte & icons8
