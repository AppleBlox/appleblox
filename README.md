<div align="center">
    <img src=".github/assets/logo.png" style="width:30%;">
</div>

---

# AppleBlox

AppleBlox is a simple Roblox launcher for **MacOS**, heavily inspired by [Bloxstrap](https://github.com/pizzaboxer/bloxstrap).
Currently, the app is in developpement and lacks important features like Discord RPC.

You can get a demo of the app from the [Releases](https://github.com/OrigamingWasTaken/appleblox/releases/latest)

For more recent builds, see the [nightly releases](https://nightly.link/OrigamingWasTaken/appleblox/workflows/build/main?preview)

## Compiled Binaries

AppleBlox contains pre-compiled binaries of some programs at `build/lib/MacOS` from:
- https://github.com/vjeantet/alerter (Taken from the github releases)
- https://github.com/Rayrsn/Discord-RPC-cli (Built from source on my machine)

I plan on modifying this too compile those binaries at build step, but that would mean having to install Rust and Go, so I'm not really sure...
If you're worried that those could be modified by me or another contributor to include malicious code, you can always scan the app on https://www.virustotal.com .

## Developpement

To setup the app on your machine, clone this repo and run `npm install`.
To start the **dev environnement**, run `npm run dev`.
To **build and package the app**, run `npm run build`.

The app is made with [Svelte](https://svelte.dev) (Frontend) and [NeutralinoJS](https://neutralino.js.org) (Backend).
If you haven't heard about NeutralinoJS, it is a lightweight alternative coded in **c++** to frameworks like Electron or NW.JS. It is still growing, but is stable enough to be used on one platform. You can learn more about it on https://neutralino.js.org/docs.

## Contributing

All contributions are welcome! Feel free to open issues and pull requests. For further discussion, contact me at `contact@origaming.ch` or on discord `@Origaming`.

## Gallery

<div align="center">
    <img src=".github/assets/src1.png" style="width:50%;">
    <img src=".github/assets/src2.png" style="width:50%;">
    <img src=".github/assets/src3.png" style="width:50%;">
</div>

## Credits

Logo found on https://macosicons.com (Sorry but I couldn't find the designer's name ^^').
Features inspirations from BloxStrap.