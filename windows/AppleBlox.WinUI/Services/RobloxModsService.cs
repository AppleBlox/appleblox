using System.Text.Json;
using AppleBlox.WinUI.Models;

namespace AppleBlox.WinUI.Services;

public sealed record RobloxMod(string Id, string Name, string Description, string DirectoryPath);

public sealed class RobloxModsService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly string _modsRoot = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AppleBlox",
        "mods");

    private readonly string _backupRoot = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AppleBlox",
        "mod-backups");

    public async Task<IReadOnlyList<RobloxMod>> LoadAsync(CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(_modsRoot)) return Array.Empty<RobloxMod>();
        var mods = new List<RobloxMod>();

        foreach (var directory in Directory.EnumerateDirectories(_modsRoot))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var manifestPath = Path.Combine(directory, "mod.json");
            if (!File.Exists(manifestPath)) continue;

            try
            {
                await using var stream = File.OpenRead(manifestPath);
                var manifest = await JsonSerializer.DeserializeAsync<ModManifest>(stream, JsonOptions, cancellationToken);
                if (manifest is not null && !string.IsNullOrWhiteSpace(manifest.Id) && !string.IsNullOrWhiteSpace(manifest.Name))
                {
                    mods.Add(new RobloxMod(manifest.Id, manifest.Name, manifest.Description ?? string.Empty, directory));
                }
            }
            catch (JsonException)
            {
                // Ignore one malformed mod instead of preventing the launcher from opening.
            }
        }

        return mods;
    }

    public Task EnableAsync(RobloxInstallation installation, RobloxMod mod, CancellationToken cancellationToken = default)
    {
        var overlayRoot = Path.Combine(mod.DirectoryPath, "files");
        if (!Directory.Exists(overlayRoot)) return Task.CompletedTask;

        var backupRoot = Path.Combine(_backupRoot, Sanitize(installation.DisplayVersion), mod.Id);
        foreach (var source in Directory.EnumerateFiles(overlayRoot, "*", SearchOption.AllDirectories))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var relativePath = Path.GetRelativePath(overlayRoot, source);
            var destination = GetSafePath(installation.VersionFolder, relativePath);
            var backup = GetSafePath(backupRoot, relativePath);

            if (File.Exists(destination) && !File.Exists(backup))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(backup)!);
                File.Copy(destination, backup, overwrite: false);
            }

            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(source, destination, overwrite: true);
        }

        return Task.CompletedTask;
    }

    public Task DisableAsync(RobloxInstallation installation, RobloxMod mod, CancellationToken cancellationToken = default)
    {
        var backupRoot = Path.Combine(_backupRoot, Sanitize(installation.DisplayVersion), mod.Id);
        if (!Directory.Exists(backupRoot)) return Task.CompletedTask;

        foreach (var backup in Directory.EnumerateFiles(backupRoot, "*", SearchOption.AllDirectories))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var relativePath = Path.GetRelativePath(backupRoot, backup);
            var destination = GetSafePath(installation.VersionFolder, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(backup, destination, overwrite: true);
        }

        Directory.Delete(backupRoot, recursive: true);
        return Task.CompletedTask;
    }

    private static string GetSafePath(string root, string relativePath)
    {
        if (Path.IsPathRooted(relativePath)) throw new ArgumentException("Mod paths must be relative.", nameof(relativePath));
        var fullRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var fullPath = Path.GetFullPath(Path.Combine(root, relativePath));
        if (!fullPath.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("A mod attempted to write outside the Roblox installation.");
        }
        return fullPath;
    }

    private static string Sanitize(string value)
    {
        return string.Concat(value.Select(character => Path.GetInvalidFileNameChars().Contains(character) ? '_' : character));
    }

    private sealed record ModManifest(string Id, string Name, string? Description);
}
