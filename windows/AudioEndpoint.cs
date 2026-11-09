using System;
using System.Runtime.InteropServices;

namespace PixelVolume;

internal readonly record struct VolumeState(int Level, bool Muted);

internal sealed class AudioEndpoint : IDisposable
{
    private readonly IDeviceEnumerator enumerator = (IDeviceEnumerator)new DeviceEnumerator();

    public VolumeState Read() => WithEndpoint(Read);

    public VolumeState Set(int level) => WithEndpoint(endpoint =>
    {
        Set(endpoint, level);
        return Read(endpoint);
    });

    public VolumeState ApplyKey(VolumeKey key) => WithEndpoint(endpoint =>
    {
        var before = Read(endpoint);
        if (key == VolumeKey.Mute)
            endpoint.SetMute(!before.Muted, IntPtr.Zero);
        else
            Set(endpoint, Math.Clamp(before.Level + (key == VolumeKey.Up ? 2 : -2), 0, 100));
        return Read(endpoint);
    });

    private static void Set(IEndpointVolume endpoint, int level)
    {
        endpoint.SetMasterVolumeLevelScalar(level / 100f, IntPtr.Zero);
        if (level > 0)
            endpoint.SetMute(false, IntPtr.Zero);
    }

    private static VolumeState Read(IEndpointVolume endpoint)
    {
        endpoint.GetMasterVolumeLevelScalar(out float volume);
        endpoint.GetMute(out bool muted);
        return new((int)Math.Round(volume * 100), muted);
    }

    private T WithEndpoint<T>(Func<IEndpointVolume, T> operation)
    {
        enumerator.GetDefaultAudioEndpoint(0, 0, out var device); // eRender, eConsole
        try
        {
            var interfaceId = typeof(IEndpointVolume).GUID;
            device.Activate(ref interfaceId, 23, IntPtr.Zero, out var endpoint); // CLSCTX_ALL
            try { return operation(endpoint); }
            finally { Marshal.ReleaseComObject(endpoint); }
        }
        finally { Marshal.ReleaseComObject(device); }
    }

    public void Dispose() => Marshal.ReleaseComObject(enumerator);

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    private class DeviceEnumerator { }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IDeviceEnumerator
    {
        void EnumAudioEndpoints();
        void GetDefaultAudioEndpoint(int flow, int role, out IDevice device);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IDevice
    {
        void Activate(ref Guid interfaceId, int classContext, IntPtr activationParameters, out IEndpointVolume endpoint);
    }

    [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IEndpointVolume
    {
        // Preserve the COM slot order. Methods the app never calls omit their parameters.
        void RegisterControlChangeNotify();
        void UnregisterControlChangeNotify();
        void GetChannelCount();
        void SetMasterVolumeLevel();
        void SetMasterVolumeLevelScalar(float level, IntPtr eventContext);
        void GetMasterVolumeLevel();
        void GetMasterVolumeLevelScalar(out float level);
        void SetChannelVolumeLevel();
        void SetChannelVolumeLevelScalar();
        void GetChannelVolumeLevel();
        void GetChannelVolumeLevelScalar();
        void SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, IntPtr eventContext);
        void GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
    }
}
