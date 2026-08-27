# AppleBlox for Windows

This directory contains the native Windows port of AppleBlox built with **C#**, **WinUI 3**, and **.NET 8**.

## Requirements

- Windows 10 version 1809 (build 17763) or later
- Visual Studio 2022 with the **.NET desktop development** and **Windows App SDK** workloads, or the .NET 8 SDK plus the Windows App SDK NuGet package
- x64 or ARM64 Windows

## Build

From the repository root:

~~~powershell
 dotnet restore windows/AppleBlox.WinUI/AppleBlox.WinUI.csproj
 dotnet build windows/AppleBlox.WinUI/AppleBlox.WinUI.csproj --configuration Release --platform x64
~~~

Open the Windows project in Visual Studio to run the app. The initial native port detects Roblox installations under %LOCALAPPDATA%\Roblox\Versions and the standard Program Files locations, launches RobloxPlayerBeta.exe, supports roblox-player URIs, and stores an optional custom installation path in %LOCALAPPDATA%\AppleBlox\settings.json.

The native Windows surface currently includes Roblox discovery and launching, roblox-player URI support, client-version checks, local settings, a local account catalog, Windows ClientAppSettings fast-flag editing, and safe mod overlay primitives. The existing Svelte/Neutralino implementation remains unchanged while the remaining features are brought over feature-by-feature.
