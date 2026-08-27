namespace AppleBlox.WinUI.Models;

public sealed record RobloxInstallation(
    string VersionFolder,
    string ExecutablePath,
    DateTime LastUpdatedUtc)
{
    public string DisplayVersion => Path.GetFileName(VersionFolder);
}

public sealed record RobloxClientVersion(
    string Version,
    string ClientVersionUpload,
    string BootstrapperVersion);

public sealed record LaunchResult(bool Succeeded, string Message)
{
    public static LaunchResult Success(string message = "Roblox started") => new(true, message);
    public static LaunchResult Failure(string message) => new(false, message);
}
