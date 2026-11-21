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
        bool supported = TaskbarGlassManager.IsSupportedWindows11;
        bool elevated = TaskbarGlassManager.IsElevated;
        bool installed = TaskbarGlassManager.IsEngineInstalled;

        TaskbarBuildStatus.Text = $"Windows build: {TaskbarGlassManager.WindowsBuild}";
        TaskbarEngineStatus.Text = TaskbarGlassManager.GetEngineStatus();

        if (!supported)
            TaskbarEngineDetail.Text = "This pack needs Windows 11. No changes are available on this Windows version.";
        else if (elevated)
            TaskbarEngineDetail.Text = "Custumuse is running as administrator. Close it and reopen normally so it can work with your standard Windows taskbar session.";
        else if (installed)
            TaskbarEngineDetail.Text = "The per-user TranslucentTB package was detected. Custumuse can save and restore its taskbar appearance settings.";
        else
            TaskbarEngineDetail.Text = "Install the optional TranslucentTB package for your Windows account, launch it once, then return here and select Check again.";

        InstallEngineButton.IsEnabled = supported && !elevated && !installed;
        ApplyTaskbarButton.IsEnabled = supported && !elevated && installed;
        RestoreTaskbarButton.IsEnabled = TaskbarGlassManager.HasBackup && !elevated;
        TaskbarBackupStatus.Text = TaskbarGlassManager.HasBackup
            ? "A copy of your original taskbar-engine settings is saved and can be restored."
            : "No taskbar backup has been created yet.";
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
        TaskbarNavButton.BorderBrush = taskbarSelected ? selectedBorder : Brushes.Transparent;
        TaskbarNavButton.Foreground = taskbarSelected ? Brushes.White : normalForeground;
    }

    private void RefreshTaskbar_Click(object sender, RoutedEventArgs e)
    {
        RefreshTaskbarStatus();
        TaskbarActionStatus.Text = "Taskbar engine status refreshed.";
    }

    private void InstallTaskbarEngine_Click(object sender, RoutedEventArgs e)
    {
        if (MessageBox.Show(
            "Custumuse uses TranslucentTB as a separate, optional open-source taskbar engine. The Microsoft Store installs it for your Windows account and does not require administrator permission.\n\nOn modern Windows 11, its helper runs within Explorer to style the taskbar's XAML background. This is not a Microsoft-supported taskbar styling API, so a future Windows update could affect compatibility. Custumuse does not bundle or modify that program.\n\nOpen its Microsoft Store page?",
            "Install optional taskbar engine",
            MessageBoxButton.YesNo,
            MessageBoxImage.Information) != MessageBoxResult.Yes)
            return;

        try
        {
            TaskbarGlassManager.OpenStoreInstallPage();
            TaskbarActionStatus.Text = "Microsoft Store opened. Install TranslucentTB, launch it once, then return and select Check again.";
        }
        catch (Exception ex)
        {
            MessageBox.Show($"The Microsoft Store page could not be opened.\n\n{ex.Message}",
                "MATRIX Custumuse", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void ApplyLiquidGlass_Click(object sender, RoutedEventArgs e)
    {
        const string changePlan =
            "MATRIX Custumuse will make these changes to your current Windows account:\n\n" +
            "1. Save a backup of your existing TranslucentTB settings.\n" +
            "2. Set the taskbar material to Acrylic with a muted violet tint.\n" +
            "3. Apply to desktop, visible-window and maximized-window taskbar states.\n" +
            "4. Hide the thin taskbar accent line.\n\n" +
            "It will NOT change pinned apps, icon order, taskbar position, personal files or Windows system binaries. " +
            "No administrator permission is needed. Use Restore original to put back your saved settings.\n\n" +
            "Apply the Liquid Glass taskbar preset now?";

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
            TaskbarActionStatus.Text = "The taskbar preset was not applied.";
            MessageBox.Show(ex.Message, "MATRIX Custumuse · Taskbar Glass",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            RefreshTaskbarStatus();
        }
    }

    private void RestoreTaskbar_Click(object sender, RoutedEventArgs e)
    {
        if (MessageBox.Show(
            "Restore the exact TranslucentTB settings that were present before the first Custumuse taskbar change? This removes the Custumuse preset and keeps your pinned apps and taskbar layout unchanged.",
            "Restore original taskbar settings", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes)
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
