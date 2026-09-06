import BuildConfig from '@root/build.config';
import child_process from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Signale } from 'signale';
import { version } from '../../../package.json';
import { filterArchitectures, getArchitectureFilter } from './utils';

async function exec(command: string): Promise<void> {
    await new Promise<void>((res, rej) => {
        child_process.exec(command, (error) => {
            if (error) rej(error);
            else res();
        });
    });
}

/**
 * Wraps a PKG installer inside a DMG using the legacy naming scheme expected by
 * the 0.8.x updater: AppleBlox-{version}_{arch}.dmg
 * Users on 0.8.6 will download this DMG, mount it, and find the PKG inside.
 */
async function createDMGWrapper(pkgPath: string, dmgOutput: string): Promise<void> {
    const tmpDir = resolve(`.tmpbuild/dmgwrap_${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    try {
        copyFileSync(pkgPath, join(tmpDir, 'Install AppleBlox.pkg'));
        if (existsSync(dmgOutput)) rmSync(dmgOutput);
        await exec(
            `hdiutil create -volname "AppleBlox" -srcfolder "${tmpDir}" -ov -format UDZO "${dmgOutput}"`
        );
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
}

async function createPKG(appPath: string, outputPath: string) {
    const tmpDir = resolve(`.tmpbuild/pkg_${Date.now()}`);
    const scriptsDir = join(tmpDir, 'scripts');
    const componentPkg = join(tmpDir, 'AppleBlox.pkg');

    mkdirSync(scriptsDir, { recursive: true });

    // Copy postinstall script and make it executable
    const postinstallSrc = resolve('./scripts/build/scripts/postinstall');
    const postinstallDst = join(scriptsDir, 'postinstall');
    const postinstallContent = readFileSync(postinstallSrc);
    writeFileSync(postinstallDst, postinstallContent, { mode: 0o755 });

    // Build component package
    await exec(
        `pkgbuild --install-location /Applications --component "${appPath}" --scripts "${scriptsDir}" --identifier com.appleblox.pkg --version "${version}" "${componentPkg}"`
    );

    // Patch distribution.xml template
    const distXmlSrc = resolve('./scripts/build/assets/installer/distribution.xml');
    const distXmlPatched = join(tmpDir, 'distribution.xml');
    const distXml = readFileSync(distXmlSrc, 'utf8').replaceAll('__VERSION__', version);
    writeFileSync(distXmlPatched, distXml);

    const resourcesDir = resolve('./scripts/build/assets/installer');

    // Build product archive
    await exec(
        `productbuild --distribution "${distXmlPatched}" --package-path "${tmpDir}" --resources "${resourcesDir}" "${outputPath}"`
    );

    rmSync(tmpDir, { recursive: true, force: true });

    // Composite the AppleBlox logo on top of the system's default .pkg cardboard box icon
    const logoPath = resolve('./scripts/build/assets/bundled-icons/dark.icns');
    if (existsSync(logoPath)) {
        await setCustomPkgIcon(outputPath, logoPath);
    }
}

async function setCustomPkgIcon(pkgPath: string, logoPath: string): Promise<void> {
    // Use a Swift script — far more reliable than JXA for AppKit compositing
    const script = `
import AppKit

let pkgPath = CommandLine.arguments[1]
let logoPath = CommandLine.arguments[2]

let ws = NSWorkspace.shared
let baseIcon = ws.icon(forFile: pkgPath)
baseIcon.size = NSSize(width: 512, height: 512)

guard let logoImg = NSImage(contentsOfFile: logoPath) else { exit(1) }

let compositeImg = NSImage(size: NSSize(width: 512, height: 512))
compositeImg.lockFocus()
baseIcon.draw(in: NSRect(x: 0, y: 0, width: 512, height: 512))
// Bottom-right corner badge
let logoSize: CGFloat = 260
let padding: CGFloat = 10
logoImg.draw(in: NSRect(x: 512 - logoSize - padding, y: padding, width: logoSize, height: logoSize))
compositeImg.unlockFocus()

ws.setIcon(compositeImg, forFile: pkgPath, options: [])
`;
    const ts = Date.now();
    const tmpScript = resolve(`.tmpbuild/set_pkg_icon_${ts}.swift`);
    const tmpBin = resolve(`.tmpbuild/set_pkg_icon_${ts}`);
    mkdirSync(resolve('.tmpbuild'), { recursive: true });
    writeFileSync(tmpScript, script);
    try {
        await exec(`swiftc -framework AppKit "${tmpScript}" -o "${tmpBin}"`);
        await exec(`"${tmpBin}" "${pkgPath}" "${logoPath}"`);
    } finally {
        rmSync(tmpScript, { force: true });
        rmSync(tmpBin, { force: true });
    }
}

async function build() {
    const logger = new Signale({ scope: 'pkg-builder' });

    if (!BuildConfig.mac) {
        logger.fatal('No macOS configuration found in build.config.ts');
        return;
    }

    const architectureFilter = getArchitectureFilter();
    const targetArchs = filterArchitectures(BuildConfig.mac.architecture, architectureFilter);

    if (targetArchs.length === 0) {
        logger.fatal(`No valid architectures found for filter: ${architectureFilter}`);
        return;
    }

    logger.info(`Creating PKG files for architectures: ${targetArchs.join(', ')}`);

    const pkgPromises = targetArchs.map(async (arch) => {
        const appTime = performance.now();
        const archLogger = new Signale({ scope: `pkg-${arch}`, interactive: false });

        archLogger.await(`Creating PKG for ${arch}`);

        const appFolder = resolve(`./dist/mac_${arch}/${BuildConfig.appName}.app`);

        if (!existsSync(appFolder)) {
            archLogger.fatal(`App bundle not found: ${appFolder}`);
            throw new Error(`App bundle not found for ${arch}`);
        }

        const infoPlistPath = join(appFolder, 'Contents/Info.plist');
        const mainExecutablePath = join(appFolder, 'Contents/MacOS/main');

        if (!existsSync(infoPlistPath) || !existsSync(mainExecutablePath)) {
            archLogger.fatal(`Invalid app bundle: ${appFolder}`);
            throw new Error(`Invalid app bundle for ${arch}`);
        }

        try {
            const pkgName = `${BuildConfig.appName}-${arch}-${version}.pkg`;
            const pkgOutput = join(resolve('./dist'), pkgName);

            if (existsSync(pkgOutput)) rmSync(pkgOutput);

            await createPKG(appFolder, pkgOutput);

            // Create a legacy DMG wrapper so 0.8.x users get the update prompt and
            // can download a file matching the old AppleBlox-{version}_{arch}.dmg URL.
            const dmgName = `${BuildConfig.appName}-${version}_${arch}.dmg`;
            const dmgOutput = join(resolve('./dist'), dmgName);
            await createDMGWrapper(pkgOutput, dmgOutput);

            archLogger.complete(`PKG + DMG wrapper for ${arch} created in ${((performance.now() - appTime) / 1000).toFixed(3)}s`);
            return { arch, success: true };
        } catch (err) {
            archLogger.fatal(`Failed to create PKG for ${arch}: ${err}`);
            return { arch, success: false, error: err };
        }
    });

    const results = await Promise.allSettled(pkgPromises);
    const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success);
    const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

    if (failed.length > 0) {
        logger.error(`${failed.length} PKG creation(s) failed, ${successful.length} succeeded`);
        process.exit(1);
    }

    logger.success(`PKG creation completed for ${successful.length} architecture(s)`);
}

if (import.meta.main) {
    build();
}
