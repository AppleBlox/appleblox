using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using AppleBlox.WinUI.Models;

namespace AppleBlox.WinUI.Services;

public sealed class RobloxFastFlagsService
{
    private static readonly Regex AllowedName = new(
        "^(FFlag|DFFlag|DFInt|FInt|DFString|FString|DFloat|FLog|DFLog)[A-Za-z0-9_]+$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };

    public string GetClientSettingsPath(RobloxInstallation installation)
    {
        return Path.Combine(installation.VersionFolder, "ClientSettings", "ClientAppSettings.json");
    }

    public async Task<JsonObject> LoadAsync(
        RobloxInstallation installation,
        CancellationToken cancellationToken = default)
    {
        var path = GetClientSettingsPath(installation);
        if (!File.Exists(path)) return new JsonObject();

        try
        {
            var json = await File.ReadAllTextAsync(path, cancellationToken);
            return JsonNode.Parse(json) as JsonObject ?? new JsonObject();
        }
        catch (JsonException)
        {
            return new JsonObject();
        }
    }

    public async Task WriteAsync(
        RobloxInstallation installation,
        IReadOnlyDictionary<string, JsonNode?> flags,
        CancellationToken cancellationToken = default)
    {
        var root = new JsonObject();
        foreach (var pair in flags)
        {
            ValidateFlag(pair.Key, pair.Value);
            root[pair.Key] = pair.Value is null
                ? null
                : JsonNode.Parse(pair.Value.ToJsonString());
        }

        var path = GetClientSettingsPath(installation);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await File.WriteAllTextAsync(path, root.ToJsonString(JsonOptions), cancellationToken);
    }

    public Task ClearAsync(RobloxInstallation installation, CancellationToken cancellationToken = default)
    {
        var path = GetClientSettingsPath(installation);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    private static void ValidateFlag(string name, JsonNode? value)
    {
        if (!AllowedName.IsMatch(name))
        {
            throw new ArgumentException($"The fast flag name '{name}' is not allowed.", nameof(name));
        }

        if (value is not null and not JsonValue)
        {
            throw new ArgumentException($"Fast flag '{name}' must be a scalar JSON value.", nameof(value));
        }
    }
}
