using System.Diagnostics;
using AppleBlox.WinUI.Models;

namespace AppleBlox.WinUI.Services;

public sealed class RobloxLaunchService
{
    public Task<LaunchResult> LaunchAsync(RobloxInstallation installation, string? robloxUri = null)
    {
        try
        {
            if (!File.Exists(installation.ExecutablePath))
            {
                return Task.FromResult(LaunchResult.Failure("The Roblox executable is no longer installed."));
            }

            var startInfo = string.IsNullOrWhiteSpace(robloxUri)
                ? new ProcessStartInfo
                {
                    FileName = installation.ExecutablePath,
                    WorkingDirectory = installation.VersionFolder,
                    UseShellExecute = true
                }
                : new ProcessStartInfo
                {
                    FileName = robloxUri,
                    UseShellExecute = true
                };

            Process.Start(startInfo);
            return Task.FromResult(LaunchResult.Success());
        }
        catch (Exception exception)
        {
            return Task.FromResult(LaunchResult.Failure($"Windows could not start Roblox: {exception.Message}"));
        }
    }

    public static void OpenFolder(string path)
    {
        if (!Directory.Exists(path)) return;
        Process.Start(new ProcessStartInfo
        {
            FileName = "explorer.exe",
            Arguments = $"\"{path}\"",
            UseShellExecute = true
        });
    }
}
