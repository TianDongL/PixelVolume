using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Forms = System.Windows.Forms;

namespace PixelVolume;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "--check-update-to")
        {
            try
            {
                var update = UpdateClient.CheckAsync().GetAwaiter().GetResult();
                File.WriteAllText(args[1], JsonSerializer.Serialize(new { current = UpdateClient.CurrentVersion,
                    latest = update.Version, updateAvailable = update.IsNewer, signatureVerified = true,
                    url = update.Download.AbsoluteUri, sha256 = update.Sha256 }));
                return 0;
            }
            catch (Exception ex) { File.WriteAllText(args[1], JsonSerializer.Serialize(new { error = ex.Message })); return 2; }
        }
        if (Array.Exists(args, arg => arg == "--check-webview"))
        {
            try { return string.IsNullOrEmpty(CoreWebView2Environment.GetAvailableBrowserVersionString()) ? 1 : 0; }
            catch { return 1; }
        }
        if (Array.Exists(args, arg => arg is "--quit" or "--uninstall"))
        {
            Signal("Local\\PixelVolume.Quit");
            if (Array.Exists(args, arg => arg == "--uninstall")) LoginStartup.RemoveOwnedShortcuts();
            return 0;
        }
        using var singleInstance = new Mutex(true, "Local\\PixelVolume.Desktop", out bool firstInstance);
        if (!firstInstance)
        {
            if (!Array.Exists(args, arg => arg == "--login")) Signal("Local\\PixelVolume.ShowWelcome");
            return 0;
        }

        var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
        var window = new VolumeWindow(Array.Exists(args, arg => arg == "--preview"),
            Array.Exists(args, arg => arg == "--diagnostics"),
            !Array.Exists(args, arg => arg == "--login"));
        using var show = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\PixelVolume.ShowWelcome");
        using var quit = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\PixelVolume.Quit");
        var showWait = ThreadPool.RegisterWaitForSingleObject(show, (_, _) =>
            app.Dispatcher.BeginInvoke(new Action(window.OpenWelcome)), null, Timeout.Infinite, false);
        var quitWait = ThreadPool.RegisterWaitForSingleObject(quit, (_, _) =>
            app.Dispatcher.BeginInvoke(new Action(app.Shutdown)), null, Timeout.Infinite, false);
        app.Run(window);
        showWait.Unregister(null);
        quitWait.Unregister(null);
        return 0;
    }

    private static void Signal(string name)
    {
        try { using var signal = EventWaitHandle.OpenExisting(name); signal.Set(); }
        catch (WaitHandleCannotBeOpenedException) { }
    }
}

internal sealed class VolumeWindow : Window
{
    private readonly WebView2CompositionControl browser = new()
    {
        DefaultBackgroundColor = Color.Transparent,
        AllowExternalDrop = false
    };
    private readonly DispatcherTimer timer = new() { Interval = TimeSpan.FromMilliseconds(160) };
    private readonly DispatcherTimer updateTimer = new() { Interval = TimeSpan.FromHours(6) };
    private bool checkingUpdate;
    private string updateStatus = $"当前版本 {UpdateClient.CurrentVersion}";
    private string? notifiedVersion;
    private readonly Forms.NotifyIcon tray;
    private readonly bool preview;
    private readonly bool diagnostics;
    private readonly bool showWelcome;
    private WelcomeWindow? welcome;
    private AudioEndpoint? audio;
    private VolumeKeys? keys;
    private VolumeState? lastPushed;
    private Rectangle anchor;
    private long dismissAt;
    private bool ready;
    private bool dragging;

    public VolumeWindow(bool preview, bool diagnostics, bool showWelcome)
    {
        this.preview = preview;
        this.diagnostics = diagnostics;
        this.showWelcome = showWelcome;
        Title = "像素音量 · Pixel Volume";
        Width = 348;
        Height = 148;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = true;
        Background = System.Windows.Media.Brushes.Transparent;
        ShowInTaskbar = preview;
        ShowActivated = false;
        Topmost = true;
        Opacity = 0;
        Content = browser;

        var menu = new Forms.ContextMenuStrip();
        menu.Items.Add("打开音量浮窗", null, (_, _) => OpenFromTray());
        menu.Items.Add("设置与使用说明…", null, (_, _) => OpenWelcome());
        menu.Items.Add("检查更新…", null, (_, _) => CheckUpdates(true));
        var startup = new Forms.ToolStripMenuItem("登录时启动");
        menu.Items.Add(startup);
        menu.Opening += (_, _) =>
        {
            startup.Checked = LoginStartup.Registered;
            startup.Text = startup.Checked && LoginStartup.DisabledByWindows
                ? "登录时启动（已在 Windows 中停用）" : "登录时启动";
        };
        startup.Click += (_, _) => ToggleLoginStartup();
        menu.Items.Add(new Forms.ToolStripSeparator());
        menu.Items.Add("退出像素音量", null, (_, _) => Application.Current.Shutdown());
        tray = new Forms.NotifyIcon
        {
            Text = "像素音量 · Pixel Volume",
            Icon = SystemIcons.Application,
            ContextMenuStrip = menu,
            Visible = true
        };
        tray.MouseClick += (_, e) => { if (e.Button == Forms.MouseButtons.Left) OpenFromTray(); };

        Loaded += Initialize;
        SourceInitialized += (_, _) => ((HwndSource)PresentationSource.FromVisual(this)).AddHook(WindowMessage);
        DpiChanged += (_, _) => Dispatcher.InvokeAsync(() => { if (ready && IsVisible) PositionWindow(); }, DispatcherPriority.Loaded);
        timer.Tick += OnTimer;
        updateTimer.Tick += (_, _) => CheckUpdates(false);
        Closed += (_, _) =>
        {
            timer.Stop();
            updateTimer.Stop();
            keys?.Dispose();
            audio?.Dispose();
            tray.Dispose();
            menu.Dispose();
            browser.Dispose();
            welcome?.Close();
        };
    }

    private async void Initialize(object sender, RoutedEventArgs e)
    {
        Loaded -= Initialize;
        CheckUpdates(false);
        updateTimer.Start();
        if (showWelcome) OpenWelcome();
        LoginStartup.UpdateExistingShortcut();
        try
        {
            audio = new AudioEndpoint();
            string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "PixelVolume", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: profile);
            await browser.EnsureCoreWebView2Async(environment);
            var core = browser.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.IsPinchZoomEnabled = false;
            core.NewWindowRequested += (_, args) => args.Handled = true;
            bool pageStarted = false;
            core.NavigationStarting += (_, args) =>
            {
                args.Cancel = pageStarted;
                pageStarted = true;
            };
            core.NavigationCompleted += (_, args) =>
            {
                if (!args.IsSuccess && args.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled)
                    Fail($"页面加载失败：{args.WebErrorStatus}");
            };
            core.ProcessFailed += (_, args) => Fail($"WebView2 已停止：{args.ProcessFailedKind}");
            core.WebMessageReceived += OnWebMessage;
            core.NavigateToString("<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><body>" +
                ReadResource("SliderResident.html") + ReadResource("DesktopBridge.html") + "</body></html>");
        }
        catch (Exception ex) { Fail(ex.Message); }
    }

    private static string ReadResource(string file)
    {
        using var reader = new StreamReader(typeof(VolumeWindow).Assembly.GetManifestResourceStream("PixelVolume." + file)!);
        return reader.ReadToEnd();
    }

    private void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (e.Source != browser.CoreWebView2.Source) return;
        using var json = JsonDocument.Parse(e.WebMessageAsJson);
        var message = json.RootElement;
        switch (message.GetProperty("type").GetString())
        {
            case "ready" when !ready:
                ready = true;
                Hide();
                Opacity = 1;
                OpenFromTray(show: preview);
                welcome?.Refresh(ready, keys != null);
                Trace("ready");
                break;
            case "volume" when ready && IsVisible:
                if (message.GetProperty("level").TryGetInt32(out int level) && level is >= 0 and <= 100)
                {
                    RunAudio(() =>
                    {
                        var state = audio!.Set(level);
                        if (state == new VolumeState(level, false))
                            lastPushed = state;
                        else
                            Push(state, force: true);
                        KeepOpen(2500);
                        Trace($"slider {state.Level} muted={state.Muted}");
                    });
                }
                break;
            case "drag-start" when IsVisible:
                dragging = true;
                KeepOpen(20000);
                break;
            case "drag-end" when IsVisible:
                dragging = false;
                KeepOpen(2500);
                break;
        }
    }

    private void OpenFromTray(bool show = true)
    {
        if (!ready) return;
        RunAudio(() =>
        {
            var state = audio!.Read();
            keys ??= new VolumeKeys(key => Dispatcher.InvokeAsync(() => OnVolumeKey(key), DispatcherPriority.Input));
            if (show) ShowVolume(state, 8000);
        });
        welcome?.Refresh(ready, keys != null);
    }

    internal void OpenWelcome()
    {
        if (welcome == null)
        {
            welcome = new WelcomeWindow(() => OpenFromTray(), enabled => SetLoginStartup(enabled), () => CheckUpdates(true));
            welcome.Closed += (_, _) => welcome = null;
        }
        welcome.Refresh(ready, keys != null);
        welcome.SetUpdateStatus(updateStatus, checkingUpdate);
        welcome.Show();
        if (welcome.WindowState == WindowState.Minimized) welcome.WindowState = WindowState.Normal;
        welcome.Activate();
        Trace("welcome shown");
    }

    private void ToggleLoginStartup()
        => SetLoginStartup(!LoginStartup.Registered);

    private async void CheckUpdates(bool manual)
    {
        if (checkingUpdate) return;
        checkingUpdate = true;
        updateStatus = "正在检查更新…";
        welcome?.SetUpdateStatus(updateStatus, true);
        try
        {
            var release = await UpdateClient.CheckAsync();
            updateStatus = release.IsNewer ? $"发现新版本 {release.Version}" : $"当前已是最新版本 {UpdateClient.CurrentVersion}";
            if (release.IsNewer && manual)
            {
                string prompt = $"当前版本：{UpdateClient.CurrentVersion}\n新版本：{release.Version}\n\n{release.Notes}\n\n是否通过浏览器下载新版安装包？下载后运行安装程序即可更新。";
                if (MessageBox.Show(prompt, "像素音量更新", MessageBoxButton.YesNo, MessageBoxImage.Information) == MessageBoxResult.Yes)
                    Process.Start(new ProcessStartInfo(release.Download.AbsoluteUri) { UseShellExecute = true });
            }
            else if (release.IsNewer && notifiedVersion != release.Version)
            {
                notifiedVersion = release.Version;
                tray.ShowBalloonTip(5000, "像素音量有新版本", $"{release.Version} 已发布，可从托盘菜单选择「检查更新」下载。", Forms.ToolTipIcon.Info);
            }
            else if (manual)
                MessageBox.Show(updateStatus, "检查更新", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception)
        {
            updateStatus = "暂时无法检查更新，请稍后重试。";
            if (manual) MessageBox.Show(updateStatus, "检查更新", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        finally
        {
            checkingUpdate = false;
            welcome?.SetUpdateStatus(updateStatus, false);
        }
    }

    private void SetLoginStartup(bool enable)
    {
        try
        {
            LoginStartup.Set(enable);
            if (enable && LoginStartup.DisabledByWindows)
                MessageBox.Show("请在 Windows 的「设置 → 应用 → 启动」中启用 PixelVolume。", Title);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or COMException)
        {
            MessageBox.Show(ex.Message, "无法修改登录启动项", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        welcome?.Refresh(ready, keys != null);
    }

    private void OnVolumeKey(VolumeKey key)
    {
        if (keys == null) return;
        RunAudio(() =>
        {
            var state = audio!.ApplyKey(key);
            ShowVolume(state, 2500);
            Trace($"key {key} {state.Level} muted={state.Muted}");
        });
    }

    private void ShowVolume(VolumeState state, int milliseconds)
    {
        if (!IsVisible)
        {
            var foreground = GetForegroundWindow();
            anchor = (foreground == IntPtr.Zero ? Forms.Screen.PrimaryScreen! : Forms.Screen.FromHandle(foreground)).WorkingArea;
            PositionWindow();
            Push(state, force: true);
            Show();
            PositionWindow();
        }
        else
        {
            Push(state);
        }
        KeepOpen(milliseconds);
        timer.Start();
    }

    private void KeepOpen(int milliseconds) => dismissAt = Environment.TickCount64 + milliseconds;

    private void OnTimer(object? sender, EventArgs e)
    {
        if (!preview && Environment.TickCount64 >= dismissAt)
        {
            timer.Stop();
            dragging = false;
            Hide();
        }
        else if (!dragging)
        {
            RunAudio(() => Push(audio!.Read()));
        }
    }

    private void Push(VolumeState state, bool force = false)
    {
        if (!force && lastPushed == state) return;
        browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { level = state.Level, muted = state.Muted }));
        lastPushed = state;
    }

    private void RunAudio(Action action)
    {
        try { action(); }
        catch (Exception ex) when (ex is COMException or Win32Exception)
        {
            keys?.Dispose();
            keys = null;
            timer.Stop();
            dragging = false;
            Hide();
            Trace(ex.Message);
            tray.ShowBalloonTip(3500, "像素音量", "暂时无法接管音量。点击托盘图标可重试。", Forms.ToolTipIcon.Warning);
            welcome?.Refresh(ready, false);
        }
    }

    private void PositionWindow()
    {
        var hwnd = new WindowInteropHelper(this).Handle;
        if (anchor.IsEmpty || !GetWindowRect(hwnd, out var rect)) return;
        int x = anchor.Left + (anchor.Width - (rect.Right - rect.Left)) / 2;
        int y = anchor.Bottom - (rect.Bottom - rect.Top) - 12;
        const uint noSizeNoZOrderNoActivate = 0x0001 | 0x0004 | 0x0010;
        SetWindowPos(hwnd, IntPtr.Zero, x, y, 0, 0, noSizeNoZOrderNoActivate);
    }

    private static IntPtr WindowMessage(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        const int wmMouseActivate = 0x0021;
        if (message != wmMouseActivate) return IntPtr.Zero;
        handled = true;
        return new IntPtr(3); // MA_NOACTIVATE, still deliver the click.
    }

    private void Fail(string message)
    {
        Trace(message);
        keys?.Dispose();
        keys = null;
        Hide();
        MessageBox.Show(message, "像素音量无法启动", MessageBoxButton.OK, MessageBoxImage.Error);
        Application.Current.Shutdown();
    }

    private void Trace(string line)
    {
        if (diagnostics)
            File.AppendAllText(Path.Combine(Path.GetTempPath(), "PixelVolume-test.log"), $"{DateTimeOffset.Now:O} {line}{Environment.NewLine}");
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr window, out Rect rect);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
}
