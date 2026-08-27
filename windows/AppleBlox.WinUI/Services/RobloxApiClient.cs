using System.Net.Http.Json;
using AppleBlox.WinUI.Models;

namespace AppleBlox.WinUI.Services;

public sealed class RobloxApiClient
{
    private readonly HttpClient _httpClient;

    public RobloxApiClient(HttpClient? httpClient = null)
    {
        _httpClient = httpClient ?? new HttpClient();
        _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("AppleBlox-Windows/0.1");
    }

    public async Task<RobloxClientVersion?> GetLatestClientVersionAsync(
        string channel = "LIVE",
        CancellationToken cancellationToken = default)
    {
        var channelPath = Uri.EscapeDataString(channel.Trim());
        using var response = await _httpClient.GetAsync(
            $"https://clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer/channel/{channelPath}",
            cancellationToken);

        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<RobloxClientVersion>(cancellationToken: cancellationToken);
    }
}
