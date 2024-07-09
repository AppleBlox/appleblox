import { os } from "@neutralinojs/lib";

class shellFS {
    /**
     * Creates the folder at the specified path.
     * @param path - The path where the folder should be created.
     */
    public static async createDirectory(path: string): Promise<void> {
        try {
            await os.execCommand(`mkdir -p "${path}"`);
        } catch (err) {
            console.error("Couldn't create directory");
            console.error(err);
        }
    }

    /**
     * Removes the file or folder at the specified path.
     * @param path - The path of the file or folder to remove.
     */
    public static async remove(path: string): Promise<void> {
        try {
            await os.execCommand(`rm -rf "${path}"`);
        } catch (err) {
            console.error("Couldn't remove the file or folder");
            console.error(err);
        }
    }

    /**
     * Writes the file at the specified path with the given content.
     * @param path - The path where the file should be written.
     * @param content - The content to write to the file.
     */
    public static async writeFile(path: string, content: string): Promise<void> {
        try {
            const escapedContent = content.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            await os.execCommand(`echo "${escapedContent}" > "${path}"`);
        } catch (err) {
            console.error("Couldn't write to the file");
            console.error(err);
        }
    }
}

export default shellFS;
