using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace PixelVolume;

internal static class LoginStartup
{
    internal static string ShortcutPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.Startup), "PixelVolume.lnk");

    internal static bool Registered => IsOwnedShortcut(ShortcutPath);

    internal static bool DisabledByWindows
    {
        get
        {
            using var key = Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder");
            return key?.GetValue("PixelVolume.lnk") is byte[] { Length: > 0 } value && value[0] is 3 or 7;
        }
    }

    internal static void Set(bool enabled)
    {
        if (!enabled)
        {
            if (IsOwnedShortcut(ShortcutPath)) File.Delete(ShortcutPath);
            return;
        }

        var executable = Environment.ProcessPath ?? throw new IOException("无法确定程序位置。");
        var shellType = Type.GetTypeFromProgID("WScript.Shell", throwOnError: true)!;
        dynamic shell = Activator.CreateInstance(shellType)!;
        try
        {
            dynamic shortcut = shell.CreateShortcut(ShortcutPath);
            try
            {
                shortcut.TargetPath = executable;
                shortcut.Arguments = "--login";
                shortcut.WorkingDirectory = Path.GetDirectoryName(executable);
                shortcut.Description = "像素音量 · Pixel Volume";
                shortcut.Save();
            }
            finally { Marshal.ReleaseComObject(shortcut); }
        }
        finally { Marshal.ReleaseComObject(shell); }
    }

    internal static void UpdateExistingShortcut()
    {
        if (!Registered) return;
        try { Set(true); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or COMException) { }
    }

    internal static void RemoveOwnedShortcuts()
    {
        foreach (var path in new[] {
            ShortcutPath,
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "像素音量.lnk"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "像素音量.lnk")
        })
            if (IsOwnedShortcut(path)) File.Delete(path);
    }

    private static bool IsOwnedShortcut(string path)
    {
        if (!File.Exists(path) || Environment.ProcessPath == null) return false;
        var shellType = Type.GetTypeFromProgID("WScript.Shell", throwOnError: true)!;
        dynamic shell = Activator.CreateInstance(shellType)!;
        try
        {
            dynamic shortcut = shell.CreateShortcut(path);
            try
            {
                string target = shortcut.TargetPath;
                return string.Equals(Path.GetFullPath(target), Path.GetFullPath(Environment.ProcessPath),
                    StringComparison.OrdinalIgnoreCase);
            }
            finally { Marshal.ReleaseComObject(shortcut); }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or COMException or ArgumentException)
        { return false; }
        finally { Marshal.ReleaseComObject(shell); }
    }
}
