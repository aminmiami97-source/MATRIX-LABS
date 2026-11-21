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
    private const int DwmSystemBackdropTransientWindow = 3; // Desktop Acrylic on supported Windows 11 builds.

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(
        IntPtr hwnd, int attribute, ref int attributeValue, int attributeSize);

    public MainWindow()
    {
        InitializeComponent();
        SourceInitialized += MainWindow_SourceInitialized;
        DetectWindows();
    }

    private void MainWindow_SourceInitialized(object? sender, EventArgs e)
    {
        ApplyDesktopAcrylicBackdrop();
    }

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
            int result = DwmSetWindowAttribute(
                hwnd, DwmwaSystemBackdropType, ref backdropType, sizeof(int));

            BackdropStatus.Text = result == 0
                ? "Desktop Acrylic active"
                : "Glass-style fallback";
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
            TransparencyStatus.Text = transparency switch
            {
                true => "Enabled",
                false => "Disabled",
                _ => "Unavailable"
            };
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
            using var key = Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");

            if (key is null || key.GetValue("EnableTransparency") is null)
                return null;

            return Convert.ToInt32(key.GetValue("EnableTransparency")) == 1;
        }
        catch
        {
            return null;
        }
    }

    private void Scan_Click(object sender, RoutedEventArgs e)
    {
        DetectWindows();
        ScanSummary.Text = "Read-only check complete. Windows version and transparency preference were inspected. No system settings were changed.";
    }

    private void Preview_Click(object sender, RoutedEventArgs e)
    {
        MessageBox.Show(
            "The Custumuse app now uses a Windows Desktop Acrylic backdrop where supported, with a glass-style visual fallback. Desktop-wide Liquid Glass customization is still in development. This preview does not modify Windows settings.",
            "MATRIX Custumuse · Liquid Glass",
            MessageBoxButton.OK,
            MessageBoxImage.Information);
    }

    private void Minimize_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void Maximize_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState == WindowState.Maximized
            ? WindowState.Normal
            : WindowState.Maximized;
    }

    private void Close_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }
}