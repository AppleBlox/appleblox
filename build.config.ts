import { type Config } from "./scripts/build/ts/config-types"
import { resolve as path } from "path"

const BuildConfig: Config = {
    projectPath: path("./frontend/dist"),
    outDir: path("./dist"),
    appName: "AppleBlox",
    description: "A MacOS Roblox Launcher",
    appBundleName: "AppleBlox",
    appIdentifier: "ch.origaming.appleblox",
    mac: {
        architecture: ["universal","arm64","x64"],
        appIcon: path("./build/assets/mac.icns"),
        minimumOS: "10.13.0"
    }
}

export default BuildConfig