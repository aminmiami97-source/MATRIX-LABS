# MATRIX Custumuse v0.3.2

MATRIX Custumuse is a Windows desktop personalization studio. The v0.3.2 preview adds an adaptive taskbar rendering route for Windows 11 build 22000 while retaining the newer DWM request route on build 22621+.

## What's new in v0.3.2

- Windows 11 build 22000 uses the Windows Accent Composition Acrylic policy on detected taskbar windows.
- Windows 11 build 22621+ retains the DWM system-backdrop request route.
- Custumuse's own WPF window also tries Accent Acrylic as a fallback on older Windows 11 builds.
- Diagnostics report which rendering route is available.
- No third-party taskbar helper is installed or launched.
- No Explorer code injection, binary patching, registry modification, or administrator elevation is used.
- Restore resets the build-22000 taskbar to the Windows-managed default appearance. It cannot reconstruct an earlier third-party accent policy.
- x64, x86, and ARM64 self-contained builds remain available.

## Compatibility notes

### Windows 11 build 22000

The 21H2 mixed taskbar can accept the legacy SetWindowCompositionAttribute Accent Policy. Custumuse requests ACCENT_ENABLE_ACRYLICBLURBEHIND with a violet tint on the detected taskbar windows.

This is an undocumented Windows interface. Explorer may reset the taskbar appearance during shell state changes or after Explorer restarts. Custumuse does not inject hooks into Explorer to intercept those resets. The preview build therefore reports the request as experimental and requires visual verification on the target PC.

### Windows 11 build 22621+

Custumuse requests DWMWA_SYSTEMBACKDROP_TYPE through DWM. Microsoft documents the system-backdrop attribute for application windows, not as a dedicated public API for Explorer taskbar styling. A successful call does not guarantee a visible taskbar material.

### Windows 10

The application can run for inspection and its own UI fallback, but the Taskbar Glass module is limited to Windows 11 in this preview.

## Taskbar apply and restore

- Apply requires the normal signed-in user session; administrator mode is not needed.
- On build 22000, the apply action saves a marker and requests the Accent Acrylic policy.
- Restore disables the accent policy and sends the taskbar a composition-changed notification so Windows can repaint its managed appearance.
- Restore returns to the Windows-managed default. It cannot recover a previous third-party taskbar policy that Custumuse cannot read.
- On build 22621+, original DWM backdrop values are stored per detected taskbar/monitor and restored where possible.

## Device support

The app is published as self-contained Windows x64, x86, and ARM64 packages. Diagnostics report OS architecture, process architecture, displays, and taskbar windows. The project manifest enables Per-Monitor-V2 DPI awareness.

## Build locally

Requires the .NET 8 SDK on Windows.

    dotnet publish .\MATRIXCustumuse\MATRIXCustumuse.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o .\publish

## Known limitations

- Windows provides no dedicated supported public API for third-party Explorer taskbar styling.
- The build-22000 Accent Policy is undocumented and can be reset by Explorer.
- The newer DWM system-backdrop request is also experimental when sent to an Explorer-owned taskbar window.
- This preview does not modify Start menu, File Explorer, Settings, pinned apps, icon positions, or personal files.