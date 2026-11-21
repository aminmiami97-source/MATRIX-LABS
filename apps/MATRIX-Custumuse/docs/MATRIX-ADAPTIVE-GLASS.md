# MATRIX Adaptive Glass — Windows 11 build 22000 compatibility

## Purpose

Make MATRIX Custumuse choose a rendering strategy based on capabilities instead of treating build 22621 as the minimum version for the whole application.

This document is an engineering plan, not a claim that Explorer taskbar styling already works on build 22000.

## Capability tiers

| Capability | Windows 11 22000 | Windows 11 22621+ |
| --- | --- | --- |
| WPF application runs | Yes | Yes |
| Windows Composition host-backdrop capability | Available | Available |
| DWM system backdrop attribute (DWMWA_SYSTEMBACKDROP_TYPE) | Not available | Available |
| Direct, supported Explorer taskbar styling API | Not provided | Not provided |

Microsoft documents the Composition system-backdrop interface from Windows 11 build 22000. Microsoft documents DWMWA_SYSTEMBACKDROP_TYPE from build 22621. Neither document defines a supported public API for applying those materials to Explorer's taskbar.

## Proposed engine architecture

1. **Capability probe** — detect OS build, DWM attribute availability, composition availability, transparency preference, high contrast, remote session, GPU/composition state, and display/taskbar geometry.
2. **Native app material** — use the supported Windows composition material path for Custumuse's own surfaces when available. Fall back to an opaque theme when materials are unavailable.
3. **Taskbar strategy** — keep direct DWM requests gated to build 22621+ and label them experimental. Never report success based only on a successful API call; verify read-back and ask for visual confirmation.
4. **Build 22000 strategy** — investigate a separate user-session overlay prototype. It must be click-through, non-activating, aligned to each taskbar, multi-monitor/DPI aware, and easy to stop. If it cannot preserve taskbar interaction and shell stability, show preview-only mode rather than applying it.
5. **Restore and safety** — save only settings MATRIX changes, never patch Explorer binaries, inject into Explorer, disable security features, or request elevation for a per-user appearance effect.

## Required validation before enabling the legacy taskbar mode

- Test on Windows 11 build 22000 in a disposable test profile or virtual machine.
- Verify Start, Search, pinned apps, notification area, taskbar context menus, drag/drop, auto-hide, and window activation still work.
- Test top/bottom/left/right taskbar positions where supported, mixed DPI, multiple monitors, display hot-plug, sleep/resume, Explorer restart, and sign-out.
- Verify the overlay does not steal clicks, keyboard focus, or accessibility navigation.
- Verify Restore/Stop removes the overlay immediately and after a crash/restart.
- Do not expose an Apply button until all critical interaction tests pass.

## User-facing compatibility labels

- **Native Acrylic request (22621+)** — experimental request; visual result must be checked.
- **Adaptive preview (22000+)** — previews the intended appearance; does not claim the Explorer taskbar changed.
- **Unsupported / reduced effects** — explain the specific missing capability and retain a usable solid-color fallback.

## References

- Microsoft Learn: ICompositionSupportsSystemBackdrop (introduced in Windows 11 10.0.22000.0): https://learn.microsoft.com/en-us/uwp/api/windows.ui.composition.icompositionsupportssystembackdrop
- Microsoft Learn: DWMWINDOWATTRIBUTE; DWMWA_SYSTEMBACKDROP_TYPE is supported starting with Windows 11 build 22621: https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwmwindowattribute
- Microsoft Learn: Materials overview and fallback behavior: https://learn.microsoft.com/en-us/windows/apps/develop/ui/materials
