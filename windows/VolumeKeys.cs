using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace PixelVolume;

internal enum VolumeKey { Mute = 0xAD, Down = 0xAE, Up = 0xAF }

internal sealed class VolumeKeys : IDisposable
{
    private const int WhKeyboardLl = 13;
    private const int WmKeyDown = 0x100;
    private const int WmSysKeyDown = 0x104;
    private readonly Action<VolumeKey> onKey;
    private readonly HookProc callback;
    private readonly IntPtr hook;
    private bool muteHeld;

    public VolumeKeys(Action<VolumeKey> onKey)
    {
        this.onKey = onKey;
        callback = HandleKey;
        hook = SetWindowsHookEx(WhKeyboardLl, callback, GetModuleHandle(null), 0);
        if (hook == IntPtr.Zero)
            throw new Win32Exception(Marshal.GetLastWin32Error());
    }

    private IntPtr HandleKey(int code, IntPtr message, IntPtr data)
    {
        if (code >= 0)
        {
            var key = (VolumeKey)Marshal.ReadInt32(data);
            if (key is VolumeKey.Mute or VolumeKey.Down or VolumeKey.Up)
            {
                bool pressed = message.ToInt64() is WmKeyDown or WmSysKeyDown;
                if (pressed && (key != VolumeKey.Mute || !muteHeld))
                    onKey(key);
                if (key == VolumeKey.Mute)
                    muteHeld = pressed;
                return new IntPtr(1);
            }
        }
        return CallNextHookEx(hook, code, message, data);
    }

    public void Dispose() => UnhookWindowsHookEx(hook);

    private delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);

    [DllImport("user32.dll", EntryPoint = "SetWindowsHookExW", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int hookType, HookProc callback, IntPtr module, uint threadId);

    [DllImport("kernel32.dll", EntryPoint = "GetModuleHandleW", CharSet = CharSet.Unicode)]
    private static extern IntPtr GetModuleHandle(string? moduleName);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hook);
}
