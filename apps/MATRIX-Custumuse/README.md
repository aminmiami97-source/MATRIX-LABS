# MATRIX Custumuse v0.3.0

The first independent MATRIX Glass Engine experiment for the Windows 11 taskbar.

## What's new
- Removes the TranslucentTB integration entirely.
- Uses MATRIX's own C# controller to call Windows Desktop Window Manager (DWM) APIs.
- Detects Explorer taskbar windows: Shell_TrayWnd and Shell_SecondaryTrayWnd.
- Requests Desktop Acrylic (DWMSBT_TRANSIENTWINDOW) on those taskbar windows.
- Reads and backs up each taskbar window's original DWM backdrop type before applying.
- Adds review-before-apply and restore-original flows.
- Blocks applying when TranslucentTB is running so two taskbar style engines do not compete.
- No administrator elevation, Explorer injection, DLL patching, system file replacement, or changes to pinned app layout.

## Important compatibility note
Microsoft documents DWMWA_SYSTEMBACKDROP_TYPE (attribute 38) and DWMSBT_TRANSIENTWINDOW (value 3) as Desktop Acrylic on Windows 11 build 22621 and later.

However, Microsoft does not provide a dedicated supported public API for third-party customization of the Explorer taskbar. Custumuse's direct DWM request against Explorer's taskbar HWND is therefore experimental. Windows may reject it, ignore the visual effect, or reset it during shell updates. The app checks the HRESULT and keeps the original setting for restoration. A successful DWM call does not guarantee every Windows build will visibly render Acrylic on the taskbar.

Official API documentation:
- https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwmwindowattribute
- https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwm_systembackdrop_type

## Build
Requires .NET 8 SDK on Windows.

```powershell
dotnet publish .\MATRIXCustumuse\MATRIXCustumuse.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o .\publish
```

## Safety and restore
The taskbar effect applies to the current interactive Windows desktop. Custumuse stores its backup at:
%LOCALAPPDATA%\MATRIX Custumuse\Backups\TaskbarGlassDwm\dwm-taskbar-backup.json

Use **Restore original** to restore the DWM backdrop type captured before applying. If Windows rejects the effect, Custumuse reports the HRESULT and attempts to return already-updated taskbar windows to their original values.
