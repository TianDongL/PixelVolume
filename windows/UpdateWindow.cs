using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows;
using System.Windows.Controls;

namespace PixelVolume;

internal sealed class UpdateWindow : Window
{
    private readonly UpdateRelease release;
    private readonly TextBlock status = new() { TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 12, 0, 8) };
    private readonly ProgressBar progress = new() { Minimum = 0, Maximum = 100, Height = 10 };
    private readonly Button action = new() { Content = "下载更新", MinWidth = 120, Padding = new Thickness(16, 8, 16, 8) };
    private readonly Button cancel = new() { Content = "稍后", MinWidth = 90, Padding = new Thickness(16, 8, 16, 8), Margin = new Thickness(10, 0, 0, 0) };
    private CancellationTokenSource? pending;
    private string? installer;
    private bool closed;

    internal UpdateWindow(UpdateRelease release)
    {
        this.release = release;
        Title = "像素音量更新";
        Width = 500;
        SizeToContent = SizeToContent.Height;
        ResizeMode = ResizeMode.NoResize;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        var body = new StackPanel { Margin = new Thickness(26) };
        body.Children.Add(new TextBlock { Text = $"新版本 {release.Version}", FontSize = 22, FontWeight = FontWeights.SemiBold });
        body.Children.Add(new TextBlock { Text = $"当前版本 {UpdateClient.CurrentVersion} · 安装包 {release.Size / 1048576.0:F1} MB", Margin = new Thickness(0, 8, 0, 14) });
        body.Children.Add(new ScrollViewer { MaxHeight = 220, VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            Content = new TextBlock { Text = release.Notes, TextWrapping = TextWrapping.Wrap } });
        status.Text = "下载并校验完成后，由你选择重启安装。";
        body.Children.Add(status);
        body.Children.Add(progress);
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 20, 0, 0) };
        buttons.Children.Add(action);
        buttons.Children.Add(cancel);
        body.Children.Add(buttons);
        Content = body;
        action.Click += (_, _) => { if (installer == null) Download(); else Install(); };
        cancel.Click += (_, _) => { if (pending != null) pending.Cancel(); else Close(); };
        Closed += (_, _) => { closed = true; pending?.Cancel(); };
    }

    private async void Download()
    {
        if (pending != null) return;
        using var operation = new CancellationTokenSource();
        pending = operation;
        action.IsEnabled = false;
        cancel.Content = "取消下载";
        progress.Value = 0;
        status.Text = "正在下载更新…";
        try
        {
            using var downloader = new UpdateDownload();
            string cache = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PixelVolumeUpdates");
            installer = await downloader.DownloadAsync(release, cache, new Progress<long>(received =>
            {
                if (closed) return;
                progress.Value = received * 100.0 / release.Size;
                status.Text = $"已下载 {received / 1048576.0:F1} / {release.Size / 1048576.0:F1} MB（{progress.Value:F0}%）";
            }), operation.Token);
            if (closed) return;
            status.Text = "下载完成，文件校验通过。更新时会短暂退出，安装完成后自动重新打开。";
            action.Content = "重启并更新";
        }
        catch (OperationCanceledException) { if (!closed) status.Text = "下载已取消或超时，可以重新下载。"; }
        catch (Exception) { if (!closed) status.Text = "下载或文件校验失败，请检查网络后重试。当前版本可以继续使用。"; }
        finally
        {
            pending = null;
            if (!closed) { action.IsEnabled = true; cancel.Content = "稍后"; }
        }
    }

    private async void Install()
    {
        if (installer == null || pending != null) return;
        using var operation = new CancellationTokenSource();
        pending = operation;
        action.IsEnabled = cancel.IsEnabled = false;
        status.Text = "正在再次校验安装包…";
        try
        {
            using var verified = await UpdateDownload.OpenVerifiedAsync(installer, release, operation.Token);
            operation.Token.ThrowIfCancellationRequested();
            if (closed) return;
            string directory = Path.GetDirectoryName(Environment.ProcessPath) ?? throw new IOException();
            // NSIS /D must be the last argument and must not be quoted (spaces are supported).
            if (directory.IndexOfAny(new[] { '"', '\r', '\n' }) >= 0) throw new IOException();
            using var process = Process.Start(new ProcessStartInfo(installer)
            {
                Arguments = "/S /INAPPUPDATE /D=" + directory,
                WorkingDirectory = Path.GetDirectoryName(installer)!,
                UseShellExecute = false
            }) ?? throw new IOException();
            Application.Current.Shutdown();
        }
        catch (Exception)
        {
            if (!closed)
            {
                installer = null;
                action.Content = "重新下载";
                status.Text = "无法开始更新。当前版本仍可使用，请重新下载后再试。";
            }
        }
        finally { pending = null; if (!closed) action.IsEnabled = cancel.IsEnabled = true; }
    }
}
