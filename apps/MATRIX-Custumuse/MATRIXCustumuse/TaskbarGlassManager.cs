using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Text.Json;

namespace MATRIXCustumuse;

/// <summary>
/// Diagnostics and reversible DWM backdrop requests for every Explorer taskbar HWND
/// exposed on the current desktop. DWM documents the backdrop attribute for windows,
/// not as a dedicated public Explorer-taskbar customization API, so the visual result
/// remains experimental and is reported as such.
/// </summary>
internal static class TaskbarGlassManager
{
    private const int DwmwaSystemBackdropType = 38;
    private const int DwmSystemBackdropAuto = 0;
    private const int DwmSystemBackdropNone = 1;
    private const int DwmSystemBackdropMainWindow = 2;
    private const int DwmSystemBackdropTransientWindow = 3;
    private const int DwmSystemBackdropTabbedWindow = 4;

    private const string MainTaskbarClass = "Shell_TrayWnd";
    private const string SecondaryTaskbarClass = "Shell_SecondaryTrayWnd";
    private const uint MonitorInfoPrimary = 1;
    private const uint MonitorDefaultToNearest = 2;

    private static readonly string BackupDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MATRIX Custumuse", "Backups", "TaskbarGlassDwm");

    private static string BackupPath => Path.Combine(BackupDirectory, "dwm-taskbar-backup.json");

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(
        IntPtr hwnd, int attribute, ref int attributeValue, int attributeSize);

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmGetWindowAttribute(
        IntPtr hwnd, int attribute, out int attributeValue, int attributeSize);

    private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);
    private delegate bool MonitorEnumProc(IntPtr monitor, IntPtr hdc, IntPtr rect, IntPtr data);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetClassName(IntPtr hwnd, StringBuilder className, int maxCount);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool GetWindowRect(IntPtr hwnd, out NativeRect rect);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfoEx info);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool EnumDisplayMonitors(
        IntPtr hdc, IntPtr clipRect, MonitorEnumProc callback, IntPtr data);

    public static int WindowsBuild => Environment.OSVersion.Version.Build;
    public static string WindowsVersion => Environment.OSVersion.Version.ToString();
    public static string ProcessArchitecture => RuntimeInformation.ProcessArchitecture.ToString();
    public static string OSArchitecture => RuntimeInformation.OSArchitecture.ToString();
    public static bool IsWindows => OperatingSystem.IsWindows();
    public static bool IsWindows11 => IsWindows && WindowsBuild >= 22000;
    public static bool IsSupportedAcrylicBuild => IsWindows11 && WindowsBuild >= 22621;
    public static bool HasBackup => File.Exists(BackupPath);

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

    public static TaskbarDiagnostics Diagnose()
    {
        var monitors = GetMonitors();
        var taskbars = FindTaskbarWindows();

        bool elevated = IsElevated;
        bool legacyTool = IsLegacyTaskbarToolRunning;
        bool canApply = IsSupportedAcrylicBuild && !elevated && !legacyTool && taskbars.Count > 0;

        string status;
        string detail;

        if (!IsWindows)
        {
            status = "Windows is required";
            detail = "MATRIX Custumuse is a Windows desktop application.";
        }
        else if (!IsWindows11)
        {
            status = "Windows 10 detected · diagnostics only";
            detail = "The app can run here, but the Windows 11 Desktop Acrylic taskbar request is not available on Windows 10.";
        }
        else if (!IsSupportedAcrylicBuild)
        {
            status = "Windows 11 detected · Acrylic unavailable";
            detail = "This Windows build is older than 22621. The DWM system-backdrop attribute used for Desktop Acrylic requires Windows 11 build 22621 or later.";
        }
        else if (elevated)
        {
            status = "Reopen Custumuse normally";
            detail = "The taskbar runs in the standard signed-in desktop session. Administrator mode is not required and can prevent the app from matching the shell session.";
        }
        else if (legacyTool)
        {
            status = "Another taskbar styling tool is running";
            detail = "Close TranslucentTB before testing MATRIX Glass Engine. Custumuse does not use it; this check prevents two taskbar effects from competing.";
        }
        else if (taskbars.Count == 0)
        {
            status = "No Explorer taskbar windows found";
            detail = "The normal Windows taskbar window classes were not found. Check that the Windows desktop shell has finished loading, then run diagnostics again.";
        }
        else
        {
            status = "MATRIX Glass Engine · taskbar detected";
            detail = $"Detected {taskbars.Count} taskbar window(s) across {monitors.Count} display(s). The DWM request can be tested on this Windows 11 build.";
        }

        var report = new StringBuilder();
        report.AppendLine("MATRIX Custumuse — Taskbar diagnostics");
        report.AppendLine();
        report.AppendLine($"Windows: {(IsWindows ? "Yes" : "No")} · Version {WindowsVersion} · Build {WindowsBuild}");
        report.AppendLine($"OS architecture: {OSArchitecture} · App architecture: {ProcessArchitecture}");
        report.AppendLine($"Displays detected: {monitors.Count}");
        report.AppendLine($"Taskbar windows detected: {taskbars.Count}");
        report.AppendLine($"Desktop Acrylic API build requirement met: {(IsSupportedAcrylicBuild ? "Yes" : "No")}");
        report.AppendLine($"Running elevated: {(elevated ? "Yes" : "No")}");
        report.AppendLine($"Other taskbar styling process detected: {(legacyTool ? "Yes" : "No")}");
        report.AppendLine();
        report.AppendLine("Detected taskbar surfaces:");

        if (taskbars.Count == 0)
        {
            report.AppendLine("  No Shell_TrayWnd or Shell_SecondaryTrayWnd window was found.");
        }
        else
        {
            for (int i = 0; i < taskbars.Count; i++)
            {
                var item = taskbars[i];
                string current = item.DwmReadHResult == 0
                    ? DescribeBackdrop(item.CurrentBackdrop)
                    : $"Read failed (HRESULT 0x{item.DwmReadHResult:X8})";

                report.AppendLine(
                    $"  {i + 1}. {item.ClassName} · {item.MonitorDevice} · {(item.IsPrimaryMonitor ? "Primary display" : "Secondary display")} · {item.Edge} · {item.Bounds.Width}×{item.Bounds.Height}px");
                report.AppendLine($"     DWM backdrop query: {current}");
            }
        }

        report.AppendLine();
        report.AppendLine("Result:");
        report.AppendLine(detail);
        report.AppendLine();
        report.AppendLine("This diagnostic is read-only. It does not apply or change any taskbar setting.");
        report.AppendLine("Important: Windows documents DWM Acrylic for application windows, not a dedicated Explorer taskbar styling API. A successful DWM call does not guarantee that Explorer will visibly render the material.");

        return new TaskbarDiagnostics(
            status,
            detail,
            report.ToString(),
            canApply,
            HasBackup,
            monitors.Count,
            taskbars.Count);
    }

    public static string ApplyLiquidGlass()
    {
        EnsureCanModify();

        var taskbars = FindTaskbarWindows();
        if (taskbars.Count == 0)
            throw new InvalidOperationException("No Windows taskbar windows were found. Run taskbar diagnostics and check the Windows shell.");

        var baseline = File.Exists(BackupPath) ? ReadBackup() : new List<TaskbarWindowBackup>();
        bool backupChanged = false;

        // Capture newly attached monitors as well. Existing entries are kept so later
        // restores still know about monitors that may currently be disconnected.
        foreach (var taskbar in taskbars)
        {
            if (FindBackup(baseline, taskbar) is not null)
                continue;

            int hr = DwmGetWindowAttribute(taskbar.Hwnd, DwmwaSystemBackdropType, out int original, sizeof(int));
            if (hr != 0)
                throw new InvalidOperationException(
                    $"Windows did not allow Custumuse to read the original DWM backdrop for {taskbar.ClassName} on {taskbar.MonitorDevice} (HRESULT 0x{hr:X8}). No setting was changed.");

            baseline.Add(new TaskbarWindowBackup
            {
                ClassName = taskbar.ClassName,
                Index = taskbar.Index,
                MonitorDevice = taskbar.MonitorDevice,
                OriginalBackdropType = original
            });
            backupChanged = true;
        }

        if (backupChanged || !File.Exists(BackupPath))
            SaveBackup(baseline);

        var changed = new List<(IntPtr Hwnd, int Original)>();
        var accepted = 0;
        var verificationWarnings = new List<string>();

        foreach (var taskbar in taskbars)
        {
            var backup = FindBackup(baseline, taskbar);
            int original = backup?.OriginalBackdropType ?? DwmSystemBackdropAuto;
            int desired = DwmSystemBackdropTransientWindow;

            int setHr = DwmSetWindowAttribute(taskbar.Hwnd, DwmwaSystemBackdropType, ref desired, sizeof(int));
            if (setHr != 0)
            {
                RestoreChangedWindows(changed);
                throw new InvalidOperationException(
                    $"Windows rejected the Acrylic request for {taskbar.ClassName} on {taskbar.MonitorDevice} (HRESULT 0x{setHr:X8}). Custumuse attempted to restore any taskbars already changed. Windows may not permit this attribute on the shell taskbar.");
            }

            changed.Add((taskbar.Hwnd, original));
            accepted++;

            int readHr = DwmGetWindowAttribute(taskbar.Hwnd, DwmwaSystemBackdropType, out int after, sizeof(int));
            if (readHr != 0)
                verificationWarnings.Add($"{taskbar.MonitorDevice}: DWM accepted the request, but read-back failed (0x{readHr:X8}).");
            else if (after != DwmSystemBackdropTransientWindow)
                verificationWarnings.Add($"{taskbar.MonitorDevice}: DWM did not retain the requested Acrylic value (reported {DescribeBackdrop(after)}).");
        }

        string result = $"Windows accepted the DWM request for {accepted} taskbar window(s).";
        if (verificationWarnings.Count > 0)
            result += Environment.NewLine + string.Join(Environment.NewLine, verificationWarnings);
        result += Environment.NewLine + "Visual rendering is not guaranteed for Explorer-owned taskbar windows. Your original DWM values are backed up.";
        return result;
    }

    public static string RestoreOriginal()
    {
        EnsureNormalSession();

        if (!File.Exists(BackupPath))
            throw new InvalidOperationException("There is no saved taskbar backdrop setting to restore.");

        var baseline = ReadBackup();
        var current = FindTaskbarWindows();
        if (current.Count == 0)
            throw new InvalidOperationException("No taskbar windows were found. Your backup has been kept.");

        var remaining = new List<TaskbarWindowBackup>();
        int restored = 0;

        foreach (var entry in baseline)
        {
            var target = FindCurrentTaskbar(current, entry);
            if (target is null)
            {
                // Monitor/taskbar is currently disconnected. Retain its saved value.
                remaining.Add(entry);
                continue;
            }

            int original = entry.OriginalBackdropType;
            int hr = DwmSetWindowAttribute(target.Hwnd, DwmwaSystemBackdropType, ref original, sizeof(int));
            if (hr != 0)
                throw new InvalidOperationException(
                    $"Windows could not restore the DWM backdrop for {target.MonitorDevice} (HRESULT 0x{hr:X8}). Your backup has been kept so you can retry.");

            restored++;
        }

        if (remaining.Count == 0)
        {
            File.Delete(BackupPath);
        }
        else
        {
            SaveBackup(remaining);
        }

        return remaining.Count == 0
            ? $"Original DWM backdrop settings restored for {restored} taskbar window(s)."
            : $"Restored {restored} taskbar window(s). Backup entries for {remaining.Count} disconnected taskbar(s) were kept for a future restore.";
    }

    private static void EnsureCanModify()
    {
        EnsureNormalSession();
        if (!IsSupportedAcrylicBuild)
            throw new InvalidOperationException("The Desktop Acrylic system-backdrop API requires Windows 11 build 22621 or later. The app can still run diagnostics on Windows 10 and older Windows 11 builds.");
        if (IsLegacyTaskbarToolRunning)
            throw new InvalidOperationException("Close TranslucentTB before applying. MATRIX Glass Engine does not use it, but two taskbar styling processes can conflict.");
    }

    private static void EnsureNormalSession()
    {
        if (IsElevated)
            throw new InvalidOperationException("Close Custumuse and reopen it normally. This feature does not require administrator permission.");
    }

    private static List<TaskbarWindow> FindTaskbarWindows()
    {
        var result = new List<TaskbarWindow>();
        var classCounts = new Dictionary<string, int>(StringComparer.Ordinal);

        EnumWindows((hwnd, _) =>
        {
            var classNameBuffer = new StringBuilder(128);
            int length = GetClassName(hwnd, classNameBuffer, classNameBuffer.Capacity);
            if (length <= 0)
                return true;

            string className = classNameBuffer.ToString();
            if (className != MainTaskbarClass && className != SecondaryTaskbarClass)
                return true;

            classCounts.TryGetValue(className, out int index);
            classCounts[className] = index + 1;

            if (!GetWindowRect(hwnd, out var bounds))
                bounds = default;

            IntPtr monitor = MonitorFromWindow(hwnd, MonitorDefaultToNearest);
            var info = CreateMonitorInfo();
            bool monitorOk = monitor != IntPtr.Zero && GetMonitorInfo(monitor, ref info);

            int readHr = DwmGetWindowAttribute(hwnd, DwmwaSystemBackdropType, out int currentBackdrop, sizeof(int));

            result.Add(new TaskbarWindow
            {
                Hwnd = hwnd,
                ClassName = className,
                Index = index,
                MonitorDevice = monitorOk ? (info.Device ?? string.Empty).TrimEnd('\0', ' ') : "Unknown display",
                IsPrimaryMonitor = monitorOk && (info.Flags & MonitorInfoPrimary) != 0,
                Bounds = bounds,
                Edge = monitorOk ? DetermineTaskbarEdge(bounds, info.Monitor, info.Work) : "Unknown edge",
                DwmReadHResult = readHr,
                CurrentBackdrop = currentBackdrop
            });

            return true;
        }, IntPtr.Zero);

        return result;
    }

    private static List<MonitorSnapshot> GetMonitors()
    {
        var result = new List<MonitorSnapshot>();
        MonitorEnumProc callback = (monitor, _, _, _) =>
        {
            var info = CreateMonitorInfo();
            if (GetMonitorInfo(monitor, ref info))
            {
                result.Add(new MonitorSnapshot(
                    (info.Device ?? string.Empty).TrimEnd('\0', ' '),
                    info.Monitor.Width,
                    info.Monitor.Height,
                    (info.Flags & MonitorInfoPrimary) != 0));
            }
            return true;
        };

        _ = EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, callback, IntPtr.Zero);
        GC.KeepAlive(callback);
        return result;
    }

    private static MonitorInfoEx CreateMonitorInfo() => new()
    {
        Size = Marshal.SizeOf<MonitorInfoEx>(),
        Device = new string('\0', 32)
    };

    private static string DetermineTaskbarEdge(NativeRect taskbar, NativeRect monitor, NativeRect work)
    {
        int width = taskbar.Width;
        int height = taskbar.Height;

        int topReserved = Math.Max(0, work.Top - monitor.Top);
        int bottomReserved = Math.Max(0, monitor.Bottom - work.Bottom);
        int leftReserved = Math.Max(0, work.Left - monitor.Left);
        int rightReserved = Math.Max(0, monitor.Right - work.Right);

        if (width >= height)
        {
            if (topReserved > bottomReserved)
                return "Top";
            if (bottomReserved > 0)
                return "Bottom";

            return Math.Abs(taskbar.Top - monitor.Top) <= Math.Abs(monitor.Bottom - taskbar.Bottom)
                ? "Top"
                : "Bottom";
        }

        if (leftReserved > rightReserved)
            return "Left";
        if (rightReserved > 0)
            return "Right";

        return Math.Abs(taskbar.Left - monitor.Left) <= Math.Abs(monitor.Right - taskbar.Right)
            ? "Left"
            : "Right";
    }

    private static TaskbarWindowBackup? FindBackup(List<TaskbarWindowBackup> baseline, TaskbarWindow taskbar)
    {
        var monitorMatch = baseline.FirstOrDefault(x =>
            x.ClassName == taskbar.ClassName &&
            !string.IsNullOrWhiteSpace(x.MonitorDevice) &&
            string.Equals(x.MonitorDevice, taskbar.MonitorDevice, StringComparison.OrdinalIgnoreCase));

        return monitorMatch ?? baseline.FirstOrDefault(x =>
            x.ClassName == taskbar.ClassName && x.Index == taskbar.Index);
    }

    private static TaskbarWindow? FindCurrentTaskbar(List<TaskbarWindow> current, TaskbarWindowBackup backup)
    {
        var monitorMatch = current.FirstOrDefault(x =>
            x.ClassName == backup.ClassName &&
            !string.IsNullOrWhiteSpace(backup.MonitorDevice) &&
            string.Equals(x.MonitorDevice, backup.MonitorDevice, StringComparison.OrdinalIgnoreCase));

        return monitorMatch ?? current.FirstOrDefault(x =>
            x.ClassName == backup.ClassName && x.Index == backup.Index);
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

    private static string DescribeBackdrop(int value) => value switch
    {
        DwmSystemBackdropAuto => "Auto",
        DwmSystemBackdropNone => "None",
        DwmSystemBackdropMainWindow => "Mica",
        DwmSystemBackdropTransientWindow => "Desktop Acrylic",
        DwmSystemBackdropTabbedWindow => "Mica Alt",
        _ => $"Unknown ({value})"
    };

    private sealed class TaskbarWindow
    {
        public IntPtr Hwnd { get; init; }
        public string ClassName { get; init; } = string.Empty;
        public int Index { get; init; }
        public string MonitorDevice { get; init; } = string.Empty;
        public bool IsPrimaryMonitor { get; init; }
        public NativeRect Bounds { get; init; }
        public string Edge { get; init; } = "Unknown";
        public int DwmReadHResult { get; init; }
        public int CurrentBackdrop { get; init; }
    }

    private sealed record MonitorSnapshot(string Device, int Width, int Height, bool IsPrimary);

    private sealed class TaskbarWindowBackup
    {
        public string ClassName { get; set; } = string.Empty;
        public int Index { get; set; }
        public string MonitorDevice { get; set; } = string.Empty;
        public int OriginalBackdropType { get; set; }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
        public int Width => Right - Left;
        public int Height => Bottom - Top;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct MonitorInfoEx
    {
        public int Size;
        public NativeRect Monitor;
        public NativeRect Work;
        public uint Flags;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string Device;
    }

    internal sealed record TaskbarDiagnostics(
        string Status,
        string Detail,
        string Report,
        bool CanApply,
        bool HasBackup,
        int DisplayCount,
        int TaskbarCount);
}
