using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Text.Json;

namespace MATRIXCustumuse;

/// <summary>
/// MATRIX's own taskbar material controller. It uses documented DWM APIs and does not
/// install a third-party process, inject into Explorer, or modify Windows system files.
/// Applying a backdrop to Explorer's taskbar HWND is experimental because Microsoft
/// does not document a dedicated taskbar customization API.
/// </summary>
internal static class TaskbarGlassManager
{
    private const int DwmwaSystemBackdropType = 38;
    private const int DwmSystemBackdropAuto = 0;
    private const int DwmSystemBackdropTransientWindow = 3;
    private const string MainTaskbarClass = "Shell_TrayWnd";
    private const string SecondaryTaskbarClass = "Shell_SecondaryTrayWnd";

    private static readonly string BackupDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MATRIX Custumuse", "Backups", "TaskbarGlassDwm");
    private static string BackupPath => Path.Combine(BackupDirectory, "dwm-taskbar-backup.json");

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int attributeValue, int attributeSize);
    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmGetWindowAttribute(IntPtr hwnd, int attribute, out int attributeValue, int attributeSize);

    private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetClassName(IntPtr hwnd, StringBuilder className, int maxCount);

    public static bool IsSupportedWindows11 => OperatingSystem.IsWindows() && Environment.OSVersion.Version.Build >= 22621;
    public static int WindowsBuild => Environment.OSVersion.Version.Build;
    public static bool HasBackup => File.Exists(BackupPath);
    public static bool IsTaskbarAvailable => FindTaskbarWindows().Count > 0;

    public static bool IsElevated
    {
        get
        {
            if (!OperatingSystem.IsWindows()) return false;
            using var identity = WindowsIdentity.GetCurrent();
            return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
        }
    }

    public static bool IsLegacyTaskbarToolRunning
    {
        get
        {
            try { return Process.GetProcessesByName("TranslucentTB").Length > 0; }
            catch { return false; }
        }
    }

    public static bool CanApply =>
        IsSupportedWindows11 && !IsElevated && !IsLegacyTaskbarToolRunning && IsTaskbarAvailable;

    public static string GetEngineStatus()
    {
        if (!OperatingSystem.IsWindows()) return "Windows is required";
        if (!IsSupportedWindows11) return "Windows 11 build 22621 or later is required";
        if (IsElevated) return "Reopen Custumuse normally";
        if (IsLegacyTaskbarToolRunning) return "Close the other taskbar styling app first";
        if (!IsTaskbarAvailable) return "Windows taskbar window not found";
        return "MATRIX Glass Engine · Ready";
    }

    public static string GetEngineDetail()
    {
        if (!IsSupportedWindows11)
            return "The native DWM system-backdrop API requires Windows 11 build 22621 or later.";
        if (IsElevated)
            return "Close Custumuse and reopen it normally. Taskbar styling runs in your signed-in desktop session and does not need administrator elevation.";
        if (IsLegacyTaskbarToolRunning)
            return "Another taskbar styling app is running. Close it first so two appearance engines do not compete for the same taskbar.";
        if (!IsTaskbarAvailable)
            return "The Windows taskbar window could not be found. Sign in to the desktop and try Check taskbar again.";
        return "Built into Custumuse. Uses Windows DWM directly; no TranslucentTB installation, background helper, or Explorer injection.";
    }

    public static string ApplyLiquidGlass()
    {
        EnsureCanModify();
        var taskbars = FindTaskbarWindows();
        if (taskbars.Count == 0)
            throw new InvalidOperationException("The Windows taskbar window was not found.");

        List<TaskbarWindowBackup> baseline;
        if (File.Exists(BackupPath))
        {
            baseline = ReadBackup();
        }
        else
        {
            baseline = CaptureOriginalBackdrop(taskbars);
            SaveBackup(baseline);
        }

        var changed = new List<(IntPtr Hwnd, int Original)>();
        foreach (var taskbar in taskbars)
        {
            int original = FindOriginalBackdrop(baseline, taskbar.ClassName, taskbar.Index);
            int desired = DwmSystemBackdropTransientWindow;
            int hr = DwmSetWindowAttribute(taskbar.Hwnd, DwmwaSystemBackdropType, ref desired, sizeof(int));
            if (hr != 0)
            {
                RestoreChangedWindows(changed);
                throw new InvalidOperationException(
                    $"Windows rejected the Acrylic backdrop request for {taskbar.ClassName} (HRESULT 0x{hr:X8}). The original backdrop was restored where possible. This Windows build may not allow DWM material changes on the shell taskbar.");
            }
            changed.Add((taskbar.Hwnd, original));
        }

        return "MATRIX Glass Engine sent the Desktop Acrylic request to the Windows taskbar. Check the bar visually; Explorer may ignore or reset this request on some builds. Your original DWM backdrop setting is backed up.";
    }

    public static string RestoreOriginal()
    {
        EnsureNormalSession();
        if (!File.Exists(BackupPath))
            throw new InvalidOperationException("There is no saved taskbar backdrop setting to restore.");

        var baseline = ReadBackup();
        var current = FindTaskbarWindows();
        if (current.Count == 0)
            throw new InvalidOperationException("Windows taskbar window was not found. Your backup has been kept.");

        foreach (var taskbar in current)
        {
            int original = FindOriginalBackdrop(baseline, taskbar.ClassName, taskbar.Index);
            int hr = DwmSetWindowAttribute(taskbar.Hwnd, DwmwaSystemBackdropType, ref original, sizeof(int));
            if (hr != 0)
                throw new InvalidOperationException(
                    $"Windows could not restore {taskbar.ClassName} (HRESULT 0x{hr:X8}). Your backup has been kept so you can retry.");
        }

        File.Delete(BackupPath);
        return "The original Windows DWM backdrop setting was restored.";
    }

    private static void EnsureCanModify()
    {
        EnsureNormalSession();
        if (!IsSupportedWindows11)
            throw new InvalidOperationException("The native taskbar glass experiment requires Windows 11 build 22621 or later.");
        if (IsLegacyTaskbarToolRunning)
            throw new InvalidOperationException("Close the other taskbar styling app first. Custumuse will not change taskbar appearance while another style engine is running.");
    }

    private static void EnsureNormalSession()
    {
        if (IsElevated)
            throw new InvalidOperationException("Close Custumuse and reopen it normally. This feature does not require administrator permission.");
    }

    private static List<TaskbarWindow> FindTaskbarWindows()
    {
        var result = new List<TaskbarWindow>();
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        EnumWindows((hwnd, _) =>
        {
            var classNameBuffer = new StringBuilder(128);
            int length = GetClassName(hwnd, classNameBuffer, classNameBuffer.Capacity);
            if (length <= 0) return true;

            string className = classNameBuffer.ToString();
            if (className != MainTaskbarClass && className != SecondaryTaskbarClass)
                return true;

            counts.TryGetValue(className, out int index);
            counts[className] = index + 1;
            result.Add(new TaskbarWindow(hwnd, className, index));
            return true;
        }, IntPtr.Zero);
        return result;
    }

    private static List<TaskbarWindowBackup> CaptureOriginalBackdrop(List<TaskbarWindow> taskbars)
    {
        var result = new List<TaskbarWindowBackup>();
        foreach (var taskbar in taskbars)
        {
            int hr = DwmGetWindowAttribute(taskbar.Hwnd, DwmwaSystemBackdropType, out int original, sizeof(int));
            if (hr != 0)
                throw new InvalidOperationException(
                    $"Windows did not allow Custumuse to read the original backdrop setting on {taskbar.ClassName} (HRESULT 0x{hr:X8}). No taskbar setting was changed.");

            result.Add(new TaskbarWindowBackup
            {
                ClassName = taskbar.ClassName,
                Index = taskbar.Index,
                OriginalBackdropType = original
            });
        }
        return result;
    }

    private static int FindOriginalBackdrop(List<TaskbarWindowBackup> baseline, string className, int index)
    {
        var match = baseline.Find(x => x.ClassName == className && x.Index == index);
        return match?.OriginalBackdropType ?? DwmSystemBackdropAuto;
    }

    private static void SaveBackup(List<TaskbarWindowBackup> baseline)
    {
        Directory.CreateDirectory(BackupDirectory);
        string temp = BackupPath + ".tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(baseline, new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temp, BackupPath, overwrite: true);
    }

    private static List<TaskbarWindowBackup> ReadBackup()
    {
        try
        {
            return JsonSerializer.Deserialize<List<TaskbarWindowBackup>>(File.ReadAllText(BackupPath))
                ?? throw new InvalidDataException("The taskbar backup file is empty.");
        }
        catch (Exception ex) when (ex is IOException or JsonException or InvalidDataException)
        {
            throw new InvalidOperationException("The taskbar backup could not be read. It has been left untouched.", ex);
        }
    }

    private static void RestoreChangedWindows(List<(IntPtr Hwnd, int Original)> changed)
    {
        foreach (var entry in changed)
        {
            int previous = entry.Original;
            _ = DwmSetWindowAttribute(entry.Hwnd, DwmwaSystemBackdropType, ref previous, sizeof(int));
        }
    }

    private sealed record TaskbarWindow(IntPtr Hwnd, string ClassName, int Index);
    private sealed class TaskbarWindowBackup
    {
        public string ClassName { get; set; } = "";
        public int Index { get; set; }
        public int OriginalBackdropType { get; set; }
    }
}
