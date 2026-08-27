using System.Text.Json;

namespace AppleBlox.WinUI.Services;

public sealed record RobloxAccount(
    long UserId,
    string Username,
    string DisplayName,
    DateTime AddedAtUtc);

public sealed class RobloxAccountService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly string _accountsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AppleBlox",
        "accounts.json");

    public async Task<IReadOnlyList<RobloxAccount>> LoadAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            if (!File.Exists(_accountsPath)) return Array.Empty<RobloxAccount>();
            await using var stream = File.OpenRead(_accountsPath);
            return await JsonSerializer.DeserializeAsync<List<RobloxAccount>>(stream, JsonOptions, cancellationToken)
                ?? new List<RobloxAccount>();
        }
        catch (IOException)
        {
            return Array.Empty<RobloxAccount>();
        }
        catch (JsonException)
        {
            return Array.Empty<RobloxAccount>();
        }
    }

    public async Task AddOrUpdateAsync(
        RobloxAccount account,
        CancellationToken cancellationToken = default)
    {
        var accounts = (await LoadAsync(cancellationToken)).ToList();
        accounts.RemoveAll(existing => existing.UserId == account.UserId);
        accounts.Add(account);
        await SaveAsync(accounts, cancellationToken);
    }

    public async Task RemoveAsync(long userId, CancellationToken cancellationToken = default)
    {
        var accounts = (await LoadAsync(cancellationToken)).Where(account => account.UserId != userId).ToList();
        await SaveAsync(accounts, cancellationToken);
    }

    private async Task SaveAsync(
        IReadOnlyList<RobloxAccount> accounts,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_accountsPath)!);
        await using var stream = File.Create(_accountsPath);
        await JsonSerializer.SerializeAsync(stream, accounts, JsonOptions, cancellationToken);
    }
}
