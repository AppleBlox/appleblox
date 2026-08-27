param(
    [ValidateSet("x64", "ARM64")]
    [string] $Platform = "x64",
    [ValidateSet("Debug", "Release")]
    [string] $Configuration = "Release"
)

$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "AppleBlox.WinUI\AppleBlox.WinUI.csproj"

Write-Host "Restoring AppleBlox WinUI ($Platform)..."
dotnet restore $project

Write-Host "Building AppleBlox WinUI ($Configuration / $Platform)..."
dotnet build $project --configuration $Configuration --platform $Platform --no-restore

Write-Host "Build completed successfully."
