using System;
using System.Diagnostics;
using System.IO;
using System.Security.Principal;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace MATRIXCustumuse;

internal static class TaskbarGlassManager
{
    private const string PackageFamily = "28017CharlesMilette.TranslucentTB_v826wp6bftszj";
    private const string StoreProductId = "9PF4KZ2VN4W9";
    private const string SchemaUrl = "https://TranslucentTB.github.io/settings.schema.json";
    private const string LiquidGlassTint = "#705A86C2";

    private static string LocalAppData => Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
    private static string PackageRoot => Path.Combine(LocalAppData, "Packages", PackageFamily);
    private static string SettingsDirectory => Path.Combine(PackageRoot, "RoamingState");
    private static string SettingsPath => Path.Combine(SettingsDirectory, "settings.json");
    private static string BackupDirectory => Path.Combine(LocalAppData, "MATRIX Custumuse", "Backups", "TaskbarGlass");
    private static string BackupPath => Path.Combine(BackupDirectory, "taskbar-settings.original.json");
    private static string ManifestPath => Path.Combine(BackupDirectory, "baseline.json");
    private static string AppExecutionAlias => Path.Combine(LocalAppData, "Microsoft", "WindowsApps", "ttb.exe");

    private static readonly JsonDocumentOptions JsonReadOptions = new()
    {
        AllowTrailingCommas = true,
        CommentHandling = JsonCommentHandling.Skip
    };

    public static bool IsSupportedWindows11 => OperatingSystem.IsWindows() && Environment.OSVersion.Version.Build >= 22000;
    public static int WindowsBuild => Environment.OSVersion.Version.Build;

    public static bool IsElevated
    {
        get
        {
            if (!OperatingSystem.IsWindows()) return false;
            using var identity = WindowsIdentity.GetCurrent();
            return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
        }
    }

    public static bool HasBackup => File.Exists(ManifestPath);

    // This build deliberately supports the Store/MSIX package location only.
    public static bool IsEngineInstalled => Directory.Exists(PackageRoot) || File.Exists(AppExecutionAlias);

    public static string GetEngineStatus()
    {
        if (!IsSupportedWindows11) return "Windows 11 is required";
        if (IsElevated) return "Reopen Custumuse normally";
        return IsEngineInstalled ? "Taskbar engine detected" : "Taskbar engine not installed";
    }

    public static void OpenStoreInstallPage()
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = $"ms-windows-store://pdp/?ProductId={StoreProductId}",
            UseShellExecute = true
        });
    }

    public static string ApplyLiquidGlass()
    {
        EnsureUserSession();

        if (!IsSupportedWindows11)
            throw new InvalidOperationException("The taskbar glass pack currently supports Windows 11 only.");
        if (!IsEngineInstalled)
            throw new InvalidOperationException("Install TranslucentTB from the Microsoft Store first, launch it once, then return and select Check again.");

        Directory.CreateDirectory(SettingsDirectory);

        JsonObject root;
        if (File.Exists(SettingsPath))
        {
            try
            {
                root = JsonNode.Parse(File.ReadAllText(SettingsPath), documentOptions: JsonReadOptions) as JsonObject
                    ?? throw new InvalidDataException("The existing TranslucentTB settings file is not a JSON object.");
            }
            catch (Exception ex) when (ex is JsonException or IOException)
            {
                throw new InvalidOperationException(
                    "The existing taskbar-engine settings could not be read safely. No settings were changed. Validate the file with TranslucentTB before trying again.",
                    ex);
            }
        }
        else
        {
            root = new JsonObject();
        }

        SaveBaselineOnce();

        root["$schema"] = SchemaUrl;
        ConfigureAppearance(root, "desktop_appearance", "acrylic", LiquidGlassTint, 16.0, enabled: null);
        ConfigureAppearance(root, "visible_window_appearance", "acrylic", LiquidGlassTint, 16.0, enabled: true);
        ConfigureAppearance(root, "maximized_window_appearance", "acrylic", LiquidGlassTint, 16.0, enabled: true);

        WriteAtomically(SettingsPath, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));

        return TryStartEngine()
            ? "Liquid Glass taskbar settings were saved. TranslucentTB will reload them automatically."
            : "Liquid Glass settings were saved. Open TranslucentTB from Start once to activate the new appearance.";
    }

    public static string RestoreOriginal()
    {
        EnsureUserSession();
        if (!File.Exists(ManifestPath))
            throw new InvalidOperationException("There is no saved taskbar backup to restore.");

        BackupManifest manifest;
        try
        {
            manifest = JsonSerializer.Deserialize<BackupManifest>(File.ReadAllText(ManifestPath))
                ?? throw new InvalidDataException("The backup record is empty.");
        }
        catch (Exception ex) when (ex is JsonException or IOException)
        {
            throw new InvalidOperationException("The saved taskbar backup record could not be read. The backup has been left untouched.", ex);
        }

        if (manifest.ConfigExisted)
        {
            if (!File.Exists(BackupPath))
                throw new FileNotFoundException("The original taskbar settings backup is missing. Nothing was overwritten.", BackupPath);

            Directory.CreateDirectory(SettingsDirectory);
            string temp = SettingsPath + ".custumuse-restore.tmp";
            File.Copy(BackupPath, temp, overwrite: true);
            File.Move(temp, SettingsPath, overwrite: true);
        }
        else if (File.Exists(SettingsPath))
        {
            File.Delete(SettingsPath);
        }

        File.Delete(ManifestPath);
        if (File.Exists(BackupPath)) File.Delete(BackupPath);

        return TryStartEngine()
            ? "The original taskbar-engine settings were restored."
            : "The original settings were restored. Open TranslucentTB from Start if it is not already running.";
    }

    private static void EnsureUserSession()
    {
        if (IsElevated)
            throw new InvalidOperationException(
                "Taskbar styling runs inside your normal Windows user session and does not need administrator rights. Close Custumuse and reopen it normally (do not choose Run as administrator).");
    }

    private static void ConfigureAppearance(JsonObject root, string propertyName, string accent, string color, double blurRadius, bool? enabled)
    {
        if (root[propertyName] is not JsonObject appearance)
        {
            appearance = new JsonObject();
            root[propertyName] = appearance;
        }

        if (enabled.HasValue) appearance["enabled"] = enabled.Value;
        appearance["accent"] = accent;
        appearance["color"] = color;
        appearance["show_line"] = false;
        appearance["blur_radius"] = blurRadius;
    }

    private static void SaveBaselineOnce()
    {
        if (File.Exists(ManifestPath)) return;

        Directory.CreateDirectory(BackupDirectory);
        bool existed = File.Exists(SettingsPath);
        if (existed) File.Copy(SettingsPath, BackupPath, overwrite: true);

        var manifest = new BackupManifest
        {
            ConfigExisted = existed,
            CapturedAtUtc = DateTimeOffset.UtcNow
        };

        try
        {
            WriteAtomically(ManifestPath, JsonSerializer.Serialize(manifest, new JsonSerializerOptions { WriteIndented = true }));
        }
        catch
        {
            if (File.Exists(BackupPath)) File.Delete(BackupPath);
            throw;
        }
    }

    private static void WriteAtomically(string path, string contents)
    {
        string directory = Path.GetDirectoryName(path)
            ?? throw new InvalidOperationException("The settings directory could not be determined.");
        Directory.CreateDirectory(directory);
        string temp = path + ".custumuse.tmp";
        File.WriteAllText(temp, contents);
        File.Move(temp, path, overwrite: true);
    }

    private static bool TryStartEngine()
    {
        try
        {
            if (Process.GetProcessesByName("TranslucentTB").Length > 0)
                return true;

            if (File.Exists(AppExecutionAlias))
            {
                Process.Start(new ProcessStartInfo { FileName = AppExecutionAlias, UseShellExecute = true });
                return true;
            }

            Process.Start(new ProcessStartInfo { FileName = "ttb.exe", UseShellExecute = true });
            return true;
        }
        catch
        {
            return false;
        }
    }

    private sealed class BackupManifest
    {
        public bool ConfigExisted { get; set; }
        public DateTimeOffset CapturedAtUtc { get; set; }
    }
}
