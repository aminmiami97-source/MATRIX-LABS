# MATRIX Custumuse v0.1.1

A Windows 11 appearance customization app prototype with a Liquid Glass-inspired interface.

## What's new in v0.1.1
- Refreshed glass-style dashboard with translucent panels, layered highlights, soft violet light bloom, and rounded surfaces.
- Uses the Windows Desktop Acrylic system backdrop on supported Windows 11 builds (22621 or later).
- Falls back to the in-app glass styling when the system backdrop is unavailable.
- Custom window controls for minimize, maximize/restore, and close.
- Improved read-only Windows and transparency detection.
- No desktop or system-wide customization is applied in this preview.

## Download
The GitHub Actions workflow builds a self-contained Windows x64 executable and attaches a ZIP package to the prerelease named **custumuse-v0.1.1**.

## Build locally
Requires the .NET 8 SDK on Windows.

```powershell
dotnet publish .\MATRIXCustumuse\MATRIXCustumuse.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o .\publish
```

## Safety
This preview changes only the appearance of the Custumuse application window. It does not apply Windows theme changes, replace system files, modify Explorer, or request administrator permission. Future system customizations must show a full change plan, preserve restorable settings, request approval before applying, verify results, and provide rollback.

## Compatibility
Windows 11 x64. Desktop Acrylic is requested on Windows 11 build 22621 or later. Older Windows builds use the app's glass-style visual fallback. The executable is not code-signed; Windows may display an unknown-publisher warning. Only run builds you have reviewed.
