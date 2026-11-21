# MATRIX Custumuse v0.3.1

A Windows appearance customization app with expanded PC architecture and multi-display diagnostics.

## What's new in v0.3.1
- The **Run taskbar diagnostics** button now opens a visible report instead of silently updating a small status label.
- Reports Windows version/build, OS and app architecture, display count, discovered taskbar count, monitor device, taskbar edge/orientation, taskbar bounds, and DWM backdrop read result.
- Detects the main Windows taskbar and secondary taskbar windows across connected displays.
- Stable backup mapping by monitor device name, with backward-compatible restore of v0.3.0 backup files.
- Supports mixed-DPI display layouts through Per-Monitor-V2 DPI awareness.
- Produces separate self-contained executables for x64, x86, and ARM64 PCs.
- The app can launch on supported Windows 10 and Windows 11 PCs; true DWM Desktop Acrylic taskbar requests require Windows 11 build 22621 or later.

## Known platform limitation
Microsoft documents `DWMWA_SYSTEMBACKDROP_TYPE` for application windows and specifies Windows 11 build 22621 as the minimum for the system-backdrop API. Windows does not expose a dedicated supported public API for third-party styling of Explorer's taskbar. Direct DWM requests to the Explorer-owned taskbar are experimental: Windows may reject, ignore, or reset the effect. The diagnostics report the actual HRESULT/read-back result, but successful DWM calls still do not guarantee visible Acrylic on the taskbar.

The old `DwmEnableBlurBehindWindow` API is not a general Windows 10 taskbar blur fallback; Microsoft notes that it no longer produces the blur effect beginning with Windows 8.

## Supported build packages
- Windows x64
- Windows x86
- Windows ARM64

The app is designed for desktop and multi-monitor PC layouts. It diagnoses horizontal and vertical taskbars when Windows exposes them as standard Explorer taskbar windows.

## Build locally
Requires .NET 8 SDK on Windows.

```powershell
dotnet publish .\MATRIXCustumuse\MATRIXCustumuse.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o .\publish
```

## Safety and restore
No administrator elevation is requested. Before applying, Custumuse saves the original DWM backdrop value per monitor. Use **Restore original** to restore currently connected taskbars; backup entries for disconnected monitors are retained until they can be restored.
