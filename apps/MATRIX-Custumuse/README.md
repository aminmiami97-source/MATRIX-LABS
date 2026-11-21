# MATRIX Custumuse v0.2.0

A Windows 11 appearance customization app. This release introduces the first system customization module: a reversible Liquid Glass-inspired taskbar preset.

## What's new in v0.2.0

- New Taskbar Glass workspace.
- Optional integration with the separate TranslucentTB Microsoft Store package.
- Liquid Glass preset: Acrylic material with a muted violet tint.
- Preset is configured for desktop, visible-window and maximized-window states.
- Hides the taskbar accent line.
- Backs up the existing taskbar-engine settings before the first apply.
- Restore action restores the exact saved settings (or removes the generated config if none existed before).
- Review-before-apply confirmation.
- Current-user configuration only; no administrator rights requested.
- Does not alter pinned icons, app order, taskbar position, personal files or Windows system binaries.

## Install the optional taskbar engine

The TranslucentTB package is not bundled with Custumuse. Install it separately from the Microsoft Store:

- Product ID: `9PF4KZ2VN4W9`
- Official project: https://github.com/TranslucentTB/TranslucentTB
- The Store package is installed per user and does not require administrator permission.

After installing it, launch TranslucentTB once, return to Custumuse, open **Taskbar Glass**, and select **Check again**.

The Custumuse integration supports the Microsoft Store/MSIX package settings location. Portable copies are not auto-detected in this release.

## Important technical note

Windows does not expose a supported public API for fully restyling the modern Windows 11 taskbar. TranslucentTB is a separate open-source helper that applies taskbar materials. On the modern XAML taskbar it uses a helper within Explorer to reach the taskbar's XAML background. This is not a Microsoft-supported taskbar styling contract and future Windows updates may affect it.

Custumuse does not bundle TranslucentTB, patch Explorer binaries, inject its own code into Explorer, or request elevation. It writes only the helper's per-user `settings.json` file. TranslucentTB watches that file and reloads the settings. See https://translucenttb.dev/docs/how-it-works/ and https://translucenttb.github.io/config.html.

## Build locally

Requires the .NET 8 SDK on Windows.

```powershell
dotnet publish .\MATRIXCustumuse\MATRIXCustumuse.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o .\publish
```

## Compatibility

Windows 11 x64. The taskbar module expects the TranslucentTB Microsoft Store/MSIX package for the current user. The executable is not code-signed; Windows may display an unknown-publisher warning.
