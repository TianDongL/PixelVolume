using System;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Media;

namespace PixelVolume;

internal sealed class WelcomeWindow : Window
{
    private readonly TextBlock status = new();
    private readonly Button preview;
    private readonly CheckBox startup;
    private readonly TextBlock updateLabel = new();
    private readonly Button updateButton;
    private bool refreshing;

    internal WelcomeWindow(Action showPreview, Action<bool> setStartup, Action checkUpdates)
    {
        Title = "像素音量 · 设置与使用";
        Width = 540;
        SizeToContent = SizeToContent.Height;
        ResizeMode = ResizeMode.NoResize;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        Background = new SolidColorBrush(Color.FromRgb(28, 27, 34));
        Foreground = Brushes.WhiteSmoke;
        FontFamily = new FontFamily("Microsoft YaHei UI");
        FontSize = 13;

        var root = new StackPanel { Margin = new Thickness(28, 24, 28, 20) };
        Content = root;
        root.Children.Add(new TextBlock { Text = "像素音量已启动", FontSize = 25, FontWeight = FontWeights.SemiBold });
        root.Children.Add(new TextBlock {
            Text = "按键盘的音量加、音量减或静音键，就会显示像素浮窗。\n也可以拖动像素滑块调整音量。",
            TextWrapping = TextWrapping.Wrap, LineHeight = 23, Margin = new Thickness(0, 12, 0, 0),
            Foreground = new SolidColorBrush(Color.FromRgb(195, 189, 205))
        });
        status.Text = "正在准备音量键…";
        status.Margin = new Thickness(0, 14, 0, 8);
        status.TextWrapping = TextWrapping.Wrap;
        AutomationProperties.SetAutomationId(status, "StatusText");
        root.Children.Add(status);
        preview = MakeButton("预览音量浮窗", () => showPreview());
        preview.HorizontalAlignment = HorizontalAlignment.Left;
        preview.MinWidth = 150;
        AutomationProperties.SetAutomationId(preview, "PreviewButton");
        root.Children.Add(preview);

        startup = new CheckBox {
            Content = "登录 Windows 时自动启动", Foreground = Foreground,
            Margin = new Thickness(0, 24, 0, 0), FontSize = 14
        };
        AutomationProperties.SetAutomationId(startup, "StartupToggle");
        startup.Checked += (_, _) => { if (!refreshing) setStartup(true); };
        startup.Unchecked += (_, _) => { if (!refreshing) setStartup(false); };
        root.Children.Add(startup);
        root.Children.Add(new TextBlock {
            Text = "首次安装默认关闭，由你选择；之后可在这里或托盘菜单中更改。",
            Margin = new Thickness(19, 6, 0, 0), FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(178, 174, 188)), TextWrapping = TextWrapping.Wrap
        });
        root.Children.Add(new TextBlock {
            Text = "关闭此窗口后，应用继续在右下角托盘运行。\n再次打开应用，就能回到这个设置窗口。",
            TextWrapping = TextWrapping.Wrap, LineHeight = 21, Margin = new Thickness(0, 20, 0, 18),
            Foreground = new SolidColorBrush(Color.FromRgb(178, 174, 188))
        });
        var updateRow = new DockPanel { Margin = new Thickness(0, 0, 0, 18) };
        updateButton = MakeButton("检查更新", checkUpdates);
        updateButton.MinWidth = 100;
        AutomationProperties.SetAutomationId(updateButton, "UpdateButton");
        DockPanel.SetDock(updateButton, Dock.Right);
        updateRow.Children.Add(updateButton);
        updateLabel.VerticalAlignment = VerticalAlignment.Center;
        updateLabel.TextWrapping = TextWrapping.Wrap;
        updateLabel.Margin = new Thickness(0, 0, 12, 0);
        updateLabel.FontSize = 12;
        updateRow.Children.Add(updateLabel);
        root.Children.Add(updateRow);
        var actions = new DockPanel();
        root.Children.Add(actions);
        var exit = MakeButton("退出应用", () => Application.Current.Shutdown());
        exit.MinWidth = 100;
        AutomationProperties.SetAutomationId(exit, "QuitButton");
        DockPanel.SetDock(exit, Dock.Left);
        actions.Children.Add(exit);
        var done = MakeButton("完成", Close);
        done.MinWidth = 100;
        done.HorizontalAlignment = HorizontalAlignment.Right;
        done.IsDefault = true;
        AutomationProperties.SetAutomationId(done, "DoneButton");
        actions.Children.Add(done);
    }

    internal void SetUpdateStatus(string text, bool busy)
    {
        updateLabel.Text = text;
        updateButton.IsEnabled = !busy;
    }

    internal void Refresh(bool ready, bool keyboardActive)
    {
        preview.IsEnabled = ready;
        status.Text = keyboardActive ? "音量键已启用，按一下键盘音量键试试。"
            : ready ? "暂时无法接管当前设备，可连接音频设备后点击预览重试。" : "正在准备音量键…";
        status.Foreground = keyboardActive ? new SolidColorBrush(Color.FromRgb(170, 223, 190)) : Foreground;
        refreshing = true;
        startup.IsChecked = LoginStartup.Registered;
        startup.Content = LoginStartup.Registered && LoginStartup.DisabledByWindows
            ? "登录时启动（需要在 Windows 启动设置中启用）" : "登录 Windows 时自动启动";
        refreshing = false;
    }

    private static Button MakeButton(string text, Action action)
    {
        var button = new Button {
            Content = text, Padding = new Thickness(14, 7, 14, 7),
            Background = new SolidColorBrush(Color.FromRgb(220, 197, 245)),
            Foreground = new SolidColorBrush(Color.FromRgb(37, 26, 52)),
            BorderThickness = new Thickness(0), Cursor = System.Windows.Input.Cursors.Hand
        };
        button.Click += (_, _) => action();
        return button;
    }
}
