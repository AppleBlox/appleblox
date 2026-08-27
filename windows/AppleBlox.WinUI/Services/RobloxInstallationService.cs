using AppleBlox.WinUI.Models;

namespace AppleBlox.WinUI.Services;

public sealed class RobloxInstallationService
{
    private const string PlayerExecutable = "RobloxPlayerBeta.exe";

    public Task<RobloxInstallation?> FindAsync(string? customPath = null, CancellationToken cancellationToken = default)
    {
        return Task.Run(() => Find(customPath, cancellationToken), cancellationToken);
    }

    private static RobloxInstallation? Find(string? customPath, CancellationToken cancellationToken)
    {
        var candidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(customPath))
        {
            candidates.Add(customPath);
        }

        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);

        foreach (var root in new[]
        {
            Path.Combine(localAppData, "Roblox", "Versions"),
            Path.Combine(programFiles, "Roblox", "Versions"),
            Path.Combine(programFilesX86, "Roblox", "Versions")
        })
        {
            if (!Directory.Exists(root)) continue;
            foreach (var directory in Directory.EnumerateDirectories(root))
            {
                cancellationToken.ThrowIfCancellationRequested();
                candidates.Add(directory);
            }
        }

        return candidates
            .Select(path => CreateInstallation(path))
            .Where(installation => installation is not null)
            .OrderByDescending(installation => installation!.LastUpdatedUtc)
            .FirstOrDefault();
    }

    private static RobloxInstallation? CreateInstallation(string path)
    {
        var folder = path.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var executable = File.Exists(folder) ? folder : Path.Combine(folder, PlayerExecutable);
        if (!File.Exists(executable)) return null;

        var updated = File.GetLastWriteTimeUtc(executable);
        return new RobloxInstallation(Path.GetDirectoryName(executable)!, executable, updated);
    }
}
