using Microsoft.Win32;
using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;

namespace MATRIXCustumuse;

public partial class MainWindow : Window
{
    private const int DwmwaSystemBackdropType = 38;
    private const int DwmSystemBackdropTransientWindow = 3;

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int attributeValue, int attributeSize);

    public MainWindow()
    {
        InitializeComponent();
        SourceInitialized += MainWindow_SourceInitialized;
        DetectWindows();
        RefreshTaskbarStatus();
    }

    private void MainWindow_SourceInitialized(object? sender, EventArgs e) => ApplyDesktopAcrylicBackdrop();

    private void ApplyDesktopAcrylicBackdrop()
    {
        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 22621))
        {
            BackdropStatus.Text = "Glass-style fallback";
            return;
        }

        try
        {
            var hwnd = new WindowInteropHelper(this).Handle;
            int backdropType = DwmSystemBackdropTransientWindow;
            int result = DwmSetWindowAttribute(hwnd, DwmwaSystemBackdropType, ref backdropType, sizeof(int));
            BackdropStatus.Text = result == 0 ? "Desktop Acrylic active" : "Glass-style fallback";
        }
        catch
        {
            BackdropStatus.Text = "Glass-style fallback";
        }
    }

    private void DetectWindows()
    {
        try
        {
            var version = Environment.OSVersion.Version;
            bool isWindows11 = OperatingSystem.IsWindows() && version.Build >= 22000;
            OsStatus.Text = isWindows11 ? "Windows 11 detected" : "Windows 11 required";
            OsStatus.Foreground = isWindows11 ? Brushes.White : Brushes.Orange;
            OsVersion.Text = $"Build {version.Build} · {(Environment.Is64BitOperatingSystem ? "64-bit" : "32-bit")}";

            bool? transparency = ReadTransparencyPreference();
            TransparencyStatus.Text = transparency switch { true => "Enabled", false => "Disabled", _ => "Unavailable" };
        }
        catch
        {
            OsStatus.Text = "Detection unavailable";
            OsVersion.Text = "Could not read system details";
            TransparencyStatus.Text = "Unavailable";
        }
    }

    private static bool? ReadTransparencyPreference()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            if (key is null || key.GetValue("EnableTransparency") is null) return null;
            return Convert.ToInt32(key.GetValue("EnableTransparency")) == 1;
        }
        catch { return null; }
    }

    private void RefreshTaskbarStatus()
    {
        TaskbarBuildStatus.Text = $"Windows build: {TaskbarGlassManager.WindowsBuild}";
        TaskbarEngineStatus.Text = TaskbarGlassManager.GetEngineStatus();
        TaskbarEngineDetail.Text = TaskbarGlassManager.GetEngineDetail();
        ApplyTaskbarButton.IsEnabled = TaskbarGlassManager.CanApply;
        RestoreTaskbarButton.IsEnabled = TaskbarGlassManager.HasBackup && !TaskbarGlassManager.IsElevated;
        TaskbarBackupStatus.Text = TaskbarGlassManager.HasBackup
            ? "Your original DWM backdrop setting is saved and can be restored."
            : "No DWM taskbar backup has been created yet.";
    }

    private void Overview_Click(object sender, RoutedEventArgs e)
    {
        OverviewPage.Visibility = Visibility.Visible;
        TaskbarPage.Visibility = Visibility.Collapsed;
        SetNavigationSelection(false);
    }

    private void TaskbarGlass_Click(object sender, RoutedEventArgs e)
    {
        OverviewPage.Visibility = Visibility.Collapsed;
        TaskbarPage.Visibility = Visibility.Visible;
        SetNavigationSelection(true);
        RefreshTaskbarStatus();
    }

    private void SetNavigationSelection(bool taskbarSelected)
    {
        var selectedBackground = new SolidColorBrush(Color.FromArgb(0x2E, 0x9B, 0x7B, 0xFF));
        var selectedBorder = new SolidColorBrush(Color.FromArgb(0x5B, 0xBA, 0xA4, 0xFF));
        var normalForeground = new SolidColorBrush(Color.FromRgb(0xB8, 0xB7, 0xC9));

        OverviewNavButton.Background = taskbarSelected ? Brushes.Transparent : selectedBackground;
        OverviewNavButton.BorderBrush = taskbarSelected ? Brushes.Transparent : selectedBorder;
        OverviewNavButton.Foreground = taskbarSelected ? normalForeground : Brushes.White;

        TaskbarNavButton.Background = taskbarSelected ? selectedBackground : Brushes.Transparent;
        TaskbarNavButton.BorderBrush = taskbarSelected ? Brushes.Transparent : selectedBorder;
        TaskbarNavButton.Foreground = taskbarSelected ? Brushes.White : normalForeground;
    }

    private void RefreshTaskbar_Click(object sender, RoutedEventArgs e)
    {
        RefreshTaskbarStatus();
        TaskbarActionStatus.Text = "MATRIX Glass Engine status refreshed.";
    }

    private void ApplyLiquidGlass_Click(object sender, RoutedEventArgs e)
    {
        const string changePlan =
            "MATRIX Custumuse will request the Windows Desktop Acrylic backdrop for your taskbar window:\\n\\n" +
            "1. Read and save the current DWM backdrop setting for the taskbar.\\n" +
            "2. Request Desktop Acrylic directly from Windows DWM.\\n" +
            "3. Keep a backup so you can restore the original setting.\\n\\n" +
            "It will NOT install another taskbar app, edit another app's settings, inject code into Explorer, " +
            "replace system files, change pinned icons, change icon order, or move your taskbar.\\n\\n" +
            "This is an experimental use of the documented DWM system-backdrop API on the Explorer-owned taskbar window. " +
            "Windows may ignore or reset the request on some builds. No administrator permission is needed.\\n\\n" +
            "Apply the MATRIX Glass Engine effect?";

        if (MessageBox.Show(changePlan, "Review taskbar changes", MessageBoxButton.YesNo,
                MessageBoxImage.Question) != MessageBoxResult.Yes)
            return;

        try
        {
            TaskbarActionStatus.Text = TaskbarGlassManager.ApplyLiquidGlass();
            RefreshTaskbarStatus();
        }
        catch (Exception ex)
        {
            TaskbarActionStatus.Text = "The taskbar effect was not applied.";
            MessageBox.Show(ex.Message, "MATRIX Custumuse · Taskbar Glass",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            RefreshTaskbarStatus();
        }
    }

    private void RestoreTaskbar_Click(object sender, RoutedEventArgs e)
    {
        if (MessageBox.Show(
            "Restore the original DWM backdrop setting captured before the first MATRIX Glass Engine change? The saved backup is kept until Windows confirms the restore.",
            "Restore original taskbar appearance", MessageBoxButton.YesNo,
            MessageBoxImage.Question) != MessageBoxResult.Yes)
            return;

        try
        {
            TaskbarActionStatus.Text = TaskbarGlassManager.RestoreOriginal();
            RefreshTaskbarStatus();
        }
        catch (Exception ex)
        {
            TaskbarActionStatus.Text = "The restore operation needs attention.";
            MessageBox.Show(ex.Message, "MATRIX Custumuse · Restore",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            RefreshTaskbarStatus();
        }
    }

    private void Scan_Click(object sender, RoutedEventArgs e)
    {
        DetectWindows();
        ScanSummary.Text = "Read-only check complete. Windows version and transparency preference were inspected. No system settings were changed.";
    }

    private void Preview_Click(object sender, RoutedEventArgs e) => TaskbarGlass_Click(sender, e);
    private void Minimize_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void Maximize_Click(object sender, RoutedEventArgs e) => WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState;
    private void Close_Click(object sender, RoutedEventArgs e) => Close();
}
