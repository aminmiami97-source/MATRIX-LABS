using Microsoft.Win32;
using System;
using System.Windows;

namespace MATRIXCustumuse;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DetectWindows();
    }

    private void DetectWindows()
    {
        try
        {
            var version = Environment.OSVersion.Version;
            bool isWindows11 = OperatingSystem.IsWindows() && version.Build >= 22000;
            OsStatus.Text = isWindows11 ? "Windows 11 detected" : "Not Windows 11";
            OsStatus.Foreground = isWindows11 ? System.Windows.Media.Brushes.MediumPurple : System.Windows.Media.Brushes.Orange;
            OsVersion.Text = $"Build {version.Build} · {(Environment.Is64BitOperatingSystem ? "64-bit" : "32-bit")}";
            TransparencyStatus.Text = ReadTransparency() ? "Enabled" : "Disabled";
        }
        catch
        {
            OsStatus.Text = "Detection unavailable";
            OsVersion.Text = "Could not read system details";
            TransparencyStatus.Text = "Unknown";
        }
    }

    private static bool ReadTransparency()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            return Convert.ToInt32(key?.GetValue("EnableTransparency", 0) ?? 0) == 1;
        }
        catch { return false; }
    }

    private void Scan_Click(object sender, RoutedEventArgs e)
    {
        DetectWindows();
        ScanSummary.Text = "Read-only check complete. OS version and transparency setting were inspected. No changes were made.";
        MessageBox.Show("Safe scan completed. This preview only reads system settings; it did not modify your PC.",
            "MATRIX Custumuse", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private void Preview_Click(object sender, RoutedEventArgs e)
    {
        MessageBox.Show("Liquid Glass preview workspace is next in development. No system changes are available in this build yet.",
            "Liquid Glass Pack", MessageBoxButton.OK, MessageBoxImage.Information);
    }
}