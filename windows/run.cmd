@echo off
setlocal

where dotnet >nul 2>nul
if errorlevel 1 (
    echo .NET 8 SDK was not found. Install it from https://dotnet.microsoft.com/download/dotnet/8.0
    exit /b 1
)

set "PROJECT=%~dp0AppleBlox.WinUI\AppleBlox.WinUI.csproj"
echo Restoring AppleBlox WinUI...
dotnet restore "%PROJECT%"
if errorlevel 1 exit /b %errorlevel%

echo Starting AppleBlox WinUI...
dotnet run --project "%PROJECT%" --configuration Debug --no-restore
