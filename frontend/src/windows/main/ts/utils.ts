import { filesystem } from "@neutralinojs/lib"

/** Checks if the path provided exists */
export async function pathExists(path: string) {
    try {
        await filesystem.getStats(path)
        return true
    } catch (err) {
        return false
    }
}