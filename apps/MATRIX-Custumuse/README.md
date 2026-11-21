# MATRIX Custumuse v0.1.0

A Windows 11 appearance customization app prototype. The first planned pack is Liquid Glass.

## Included in this preview
- WPF desktop UI with dark and violet styling.
- Windows build and architecture detection.
- Read-only Windows transparency setting detection.
- Safe scan action with explicit no-change messaging.
- Liquid Glass preview entry point (placeholder).
- No system changes are applied.

## Download
The GitHub Actions workflow builds a self-contained Windows x64 executable and attaches a ZIP package to the prerelease named **custumuse-v0.1.0**.

## Build locally
Requires the .NET 8 SDK on Windows.

```powershell
dotnet publish .\MATRIXCustumuse\MATRIXCustumuse.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o .\publish
```

## Safety roadmap
Before customization features ship, the app must present a review screen listing every proposed change, save restorable settings where applicable, request elevation only when required, apply only after explicit confirmation, verify the result, and offer rollback. This version intentionally performs read-only checks only.

## Compatibility
Windows 11 x64. This prototype is not yet code-signed; Windows may display a publisher warning. Only install builds from this project's GitHub releases and review the source before running it.