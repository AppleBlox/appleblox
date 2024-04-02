import exec from "await-exec-typescript"
import { Signale } from "signale"
import fs from "fs"
import path from "path"

export async function buildBinaries() {
    const frontBuildLog = new Signale({interactive: true,scope: "vite-neutralino"})
	frontBuildLog.await("Building with Vite")
	await exec("vite build")
	frontBuildLog.await("Building with Neutralino")
	await exec("npx neu build")
	frontBuildLog.complete("App binaries were built!")
}

export function copyFolderSync(sourceDir: string, targetDir: string) {
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir);
    }

    const files = fs.readdirSync(sourceDir);

    for (const file of files) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);

        if (fs.lstatSync(sourcePath).isDirectory()) {
            copyFolderSync(sourcePath, targetPath);
        } else {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}

export async function getAllFilesInFolder(folderPath: string): Promise<string[]> {
    const files: string[] = [];
  
    async function readDirectory(directory: string): Promise<void> {
      const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  
      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
  
        if (entry.isDirectory()) {
          await readDirectory(entryPath); // Recursively read subdirectories
        } else {
          files.push(entryPath);
        }
      }
    }
  
    try {
      await readDirectory(folderPath);
      return files;
    } catch (error) {
      console.error(`Error reading directory: ${folderPath}`, error);
      throw error;
    }
  }