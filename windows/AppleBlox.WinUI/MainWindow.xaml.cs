using System.Diagnostics;
using AppleBlox.WinUI.Models;
using AppleBlox.WinUI.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Windows.UI;

namespace AppleBlox.WinUI;

public sealed partial class MainWindow : Window
{
    private readonly RobloxInstallationService _installationService = new();
    private readonly RobloxLaunchService _launchService = new();
    private readonly RobloxApiClient _apiClient = new();
    private readonly SettingsService _settingsService = new();

    private RobloxInstallation? _installation;
    private string? _customPath;
    private TextBlock? _installationText;
    private TextBlock? _statusText;
    private TextBox? _launchUriTextBox;
    private TextBox? _customPathTextBox;
    private TextBlock? _latestVersionText;

    public MainWindow()
    {
        InitializeComponent();
        RootNavigationView.SelectedItem = RootNavigationView.MenuItems[0];
        ContentFrame.Content = BuildHomePage();
        _ = InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        var settings = await _settingsService.LoadAsync();
        _customPath = settings.CustomRobloxPath;
        if (_customPathTextBox is not null) _customPathTextBox.Text = _customPath ?? string.Empty;
        await RefreshInstallationAsync();
        await RefreshLatestVersionAsync();
    }

    private async Task RefreshLatestVersionAsync()
    {
        try
        {
            var latest = await _apiClient.GetLatestClientVersionAsync();
            if (_latestVersionText is not null)
            {
                _latestVersionText.Text = latest is null
                    ? "Latest Roblox version could not be checked."
                    : $"Latest Roblox client: {latest.Version}";
            }
        }
        catch (HttpRequestException)
        {
            if (_latestVersionText is not null) _latestVersionText.Text = "Latest Roblox version is unavailable offline.";
        }
    }

    private async Task RefreshInstallationAsync()
    {
        SetStatus("Looking for Roblox on this PC…");
        _installation = await _installationService.FindAsync(_customPath);

        if (_installation is null)
        {
            if (_installationText is not null) _installationText.Text = "Roblox was not found";
            SetStatus("Install Roblox, then use Refresh to detect it.");
            return;
        }

        if (_installationText is not null)
        {
            _installationText.Text = $"{_installation.DisplayVersion}\n{_installation.ExecutablePath}";
        }
        SetStatus("Roblox is ready to launch.");
    }

    private void OnNavigationSelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        if (args.SelectedItem is not NavigationViewItem item) return;
        ContentFrame.Content = item.Tag?.ToString() switch
        {
            "roblox" => BuildRobloxPage(),
            "settings" => BuildSettingsPage(),
            "about" => BuildAboutPage(),
            _ => BuildHomePage()
        };
    }

    private FrameworkElement BuildHomePage()
    {
        var stack = new StackPanel { Spacing = 18 };
        stack.Children.Add(new TextBlock
        {
            Text = "AppleBlox",
            FontSize = 32,
            FontWeight = Windows.UI.Text.FontWeights.Bold
        });
        stack.Children.Add(new TextBlock
        {
            Text = "A focused Roblox launcher for Windows.",
            FontSize = 16,
            Opacity = 0.72
        });

        var card = new Border
        {
            Background = new SolidColorBrush(Color.FromArgb(28, 255, 255, 255)),
            BorderBrush = new SolidColorBrush(Color.FromArgb(55, 255, 255, 255)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(20)
        };
        var cardStack = new StackPanel { Spacing = 10 };
        cardStack.Children.Add(new TextBlock { Text = "Roblox installation", FontSize = 18, FontWeight = Windows.UI.Text.FontWeights.SemiBold });
        _installationText = new TextBlock { Text = "Checking…", TextWrapping = TextWrapping.Wrap, Opacity = 0.8 };
        cardStack.Children.Add(_installationText);

        var actions = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10 };
        var launch = new Button { Content = "Launch Roblox" };
        launch.Click += async (_, _) => await LaunchRobloxAsync();
        var refresh = new Button { Content = "Refresh" };
        refresh.Click += async (_, _) => await RefreshInstallationAsync();
        actions.Children.Add(launch);
        actions.Children.Add(refresh);
        var install = new Button { Content = "Install Roblox" };
        install.Click += (_, _) => OpenRobloxDownload();
        actions.Children.Add(install);
        cardStack.Children.Add(actions);
        card.Child = cardStack;
        stack.Children.Add(card);

        _statusText = new TextBlock { Text = "Starting AppleBlox…", Opacity = 0.72, TextWrapping = TextWrapping.Wrap };
        stack.Children.Add(_statusText);
        _latestVersionText = new TextBlock { Text = "Checking latest Roblox version…", Opacity = 0.72 };
        stack.Children.Add(_latestVersionText);
        return PageFrame(stack);
    }

    private FrameworkElement BuildRobloxPage()
    {
        var stack = new StackPanel { Spacing = 14 };
        stack.Children.Add(new TextBlock { Text = "Roblox", FontSize = 28, FontWeight = Windows.UI.Text.FontWeights.Bold });
        stack.Children.Add(new TextBlock
        {
            Text = "Launch the installed Windows client or pass a roblox-player URI from another tool.",
            TextWrapping = TextWrapping.Wrap,
            Opacity = 0.72
        });
        _launchUriTextBox = new TextBox { Header = "Optional launch URI", PlaceholderText = "roblox-player:1+launchmode:play+…" };
        stack.Children.Add(_launchUriTextBox);
        var launch = new Button { Content = "Launch" };
        launch.Click += async (_, _) => await LaunchRobloxAsync();
        stack.Children.Add(launch);
        var openFolder = new Button { Content = "Open Roblox installation folder" };
        openFolder.Click += (_, _) =>
        {
            if (_installation is not null) RobloxLaunchService.OpenFolder(_installation.VersionFolder);
        };
        stack.Children.Add(openFolder);
        _statusText = new TextBlock { Text = "", TextWrapping = TextWrapping.Wrap, Opacity = 0.72 };
        stack.Children.Add(_statusText);
        return PageFrame(stack);
    }

    private FrameworkElement BuildSettingsPage()
    {
        var stack = new StackPanel { Spacing = 14 };
        stack.Children.Add(new TextBlock { Text = "Settings", FontSize = 28, FontWeight = Windows.UI.Text.FontWeights.Bold });
        stack.Children.Add(new TextBlock
        {
            Text = "AppleBlox automatically scans the standard Roblox installation folders. Set a custom path only when Roblox is installed elsewhere.",
            TextWrapping = TextWrapping.Wrap,
            Opacity = 0.72
        });
        _customPathTextBox = new TextBox { Header = "Custom Roblox path", PlaceholderText = @"C:\Users\you\AppData\Local\Roblox\Versions\version-…" };
        _customPathTextBox.Text = _customPath ?? string.Empty;
        stack.Children.Add(_customPathTextBox);
        var save = new Button { Content = "Save and re-detect" };
        save.Click += async (_, _) =>
        {
            _customPath = string.IsNullOrWhiteSpace(_customPathTextBox.Text) ? null : _customPathTextBox.Text.Trim();
            await _settingsService.SaveAsync(new AppSettings(_customPath));
            await RefreshInstallationAsync();
        };
        stack.Children.Add(save);
        _statusText = new TextBlock { Text = "", TextWrapping = TextWrapping.Wrap, Opacity = 0.72 };
        stack.Children.Add(_statusText);
        return PageFrame(stack);
    }

    private static FrameworkElement BuildAboutPage()
    {
        var stack = new StackPanel { Spacing = 12 };
        stack.Children.Add(new TextBlock { Text = "About AppleBlox", FontSize = 28, FontWeight = Windows.UI.Text.FontWeights.Bold });
        stack.Children.Add(new TextBlock
        {
            Text = "The native Windows client is built with C#, WinUI 3, and .NET 8. It keeps Windows process, filesystem, and launcher behavior separate from the existing macOS implementation.",
            TextWrapping = TextWrapping.Wrap,
            Opacity = 0.8
        });
        return PageFrame(stack);
    }

    private static FrameworkElement PageFrame(UIElement child)
    {
        return new ScrollViewer
        {
            Padding = new Thickness(32),
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            Content = child
        };
    }

    private static void OpenRobloxDownload()
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = "https://www.roblox.com/download",
            UseShellExecute = true
        });
    }

    private async Task LaunchRobloxAsync()
    {
        if (_installation is null)
        {
            SetStatus("Roblox was not found. Install it or set a custom path in Settings.");
            return;
        }

        var uri = string.IsNullOrWhiteSpace(_launchUriTextBox?.Text) ? null : _launchUriTextBox.Text.Trim();
        var result = await _launchService.LaunchAsync(_installation, uri);
        SetStatus(result.Message);
    }

    private void SetStatus(string message)
    {
        if (_statusText is not null) _statusText.Text = message;
    }
}
