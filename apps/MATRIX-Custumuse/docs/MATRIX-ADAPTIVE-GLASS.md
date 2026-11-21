# MATRIX Adaptive Glass — Windows 11 build 22000 compatibility

## Implementation status

The v0.3.2 preview now implements the Windows Accent Composition Acrylic route for the Windows 11 21H2 mixed taskbar (build 22000). It keeps the DWM system-backdrop request route for Windows 11 build 22621+. The first implementation is committed to the compatibility branch and must still be visually tested on a real build-22000 PC.

## Capability routes

| Capability | Windows 11 22000 | Windows 11 22621+ |
| --- | --- | --- |
| WPF app runs | Yes | Yes |
| Custumuse own-window Acrylic fallback | Windows Accent Composition | DWM system backdrop, then Accent fallback |
| Explorer taskbar request | SetWindowCompositionAttribute Accent Policy | DWM system-backdrop request |
| Dedicated supported public Explorer taskbar styling API | Not provided | Not provided |

## Windows 11 build 22000 implementation

- Detect the primary and secondary Explorer taskbar windows.
- Request ACCENT_ENABLE_ACRYLICBLURBEHIND through SetWindowCompositionAttribute using a violet ABGR tint.
- No external taskbar helper is installed or launched.
- No code is injected into Explorer; no Explorer binaries or system files are modified.
- No registry values or administrator-protected resources are changed.
- Save a local marker recording that Custumuse applied its taskbar effect.
- Restore disables the Accent Policy and sends WM_DWMCOMPOSITIONCHANGED so Explorer can repaint its Windows-managed default appearance.

## Limitations and honest status

SetWindowCompositionAttribute is an undocumented Windows interface. The build-22000 taskbar can reset its accent policy during shell state changes or after Explorer restarts. Custumuse deliberately does not inject hooks into Explorer to intercept those resets. A successful API response is not proof that the taskbar remains styled; the user must verify the visible result.

The restore action returns the taskbar to the Windows-managed default appearance. Windows does not expose the prior Accent Policy through a documented getter, so Custumuse cannot reconstruct an earlier third-party taskbar accent exactly. The app discloses this before use.

On Windows 11 build 22621+, the project continues to try DWMWA_SYSTEMBACKDROP_TYPE. Microsoft documents that attribute for application windows, not as a dedicated API for Explorer's taskbar. The visible taskbar effect remains experimental there too.

## Required real-device validation

- Test on Windows 11 build 22000, including Start, Search, pinned apps, notification area, taskbar context menus, and click behavior.
- Test taskbar show/hide, focus changes, sleep/resume, Explorer restart, and sign-out/sign-in.
- Test secondary displays and mixed-DPI layouts.
- Confirm the effect stays visible without continuous reapplication or Explorer hooks.
- Confirm Restore resets the effect and does not block taskbar interaction.
- Keep build-22000 mode marked experimental until these checks pass on real hardware.

## Safety rules

- Apply only in the normal signed-in user session; do not request administrator elevation.
- Never patch Explorer binaries or inject code into Explorer.
- Never disable Defender, Windows Update, or other security protections.
- Never delete personal files or change pinned apps, icon order, or taskbar position.
- Explain compatibility and restore limitations before applying.