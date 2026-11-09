# 像素音量 · Pixel Volume

把键盘音量键和系统默认输出设备的音量控制，放进一个像素房间浮窗。

- Windows：WPF、WebView2、Core Audio，支持 Windows 10 2004 及以上 x64。
- macOS：AppKit、WKWebView、Core Audio，通用二进制同时包含 Intel x86_64 和 Apple arm64；最低构建目标分别为 macOS 10.15.7 和 11.0。
- 首次打开提供使用引导；登录启动默认关闭，由用户选择。
- Mac 首次使用引导用户允许辅助功能权限，以接管键盘音量键。
- 启动时及运行中每六小时检查更新；设置窗口和系统托盘／菜单栏也提供「检查更新」。用户确认后由浏览器下载对应安装包。

## 安装

[下载 Windows / Mac 安装包](https://norgateai.com/pixel-volume/)

Windows 运行 `Setup.exe`。Mac 打开 DMG，将 `Pixel Volume.app` 拖入「应用程序」，再打开并按照引导允许辅助功能权限。退出应用即可恢复系统原本的音量键处理。

Windows 当前发布物尚未做 Authenticode 签名，可能出现未知发布者或 SmartScreen 提示。Mac 发布物使用 Developer ID 签名及 Apple 公证。旧版 macOS 和真实 Intel 硬件的完整安装、登录重启仍需实机验收；Rosetta 验证不能替代真实 Intel 验收。

## 源码与构建

| 路径 | 内容 |
| --- | --- |
| `windows/` | Windows 原生宿主与音量、键盘、启动项、更新逻辑 |
| `macos/` | Mac 原生宿主、通用二进制构建脚本及登录助手 |
| `installer/` | Windows NSIS 安装器与随包说明 |
| `scripts/` | 构建、打包和生成签名更新清单 |
| `tests/` | 不启动桌面界面的更新协议测试 |
| `update-channel.json` | 公开更新地址、密钥标识及验签公钥 |

Windows 需要 .NET 10 SDK、NSIS 3 和 Microsoft 官方 WebView2 Evergreen Bootstrapper。执行：

```powershell
pwsh scripts/build-windows.ps1 -NsisCompiler C:\tools\nsis\makensis.exe -WebViewBootstrapper C:\tools\MicrosoftEdgeWebview2Setup.exe
```

Mac 需要包含 macOS SDK 的 Xcode，执行：

```bash
bash macos/build.sh
```

默认进行本地 ad-hoc 签名；正式分发设置 `PIXEL_SIGN=developer`，并在本机钥匙串中具备 Developer ID Application 身份。脚本默认只生成正式 App，不生成 QA App。开发构建不自动安装，不更改已安装应用。

## 更新发布

两端使用同一条稳定通道：

`https://norgateai.com/pixel-volume/updates/stable.json`

客户端使用内置 P-256 公钥验证清单签名，验证版本号、下载域名、不可变路径和元数据格式。清单同时包含 Windows 与 Mac 的版本、安装包地址、大小、SHA-256 和更新说明。通过浏览器下载后，由用户执行安装；校验值也提供给发布验证工具和用户核对。

详细流程见 [发布说明](docs/RELEASING.md)。私钥、Apple 凭据、SSH 配置和生产环境文件都不属于仓库内容。

## 协议测试

```bash
python -m pip install cryptography
python tests/generate_fixtures.py
dotnet run --project tests/UpdateTests.csproj -- tests/fixtures
# 在 Mac 上：
xcrun swiftc -swift-version 5 macos/UpdateClient.swift tests/main.swift -o /tmp/pixel-volume-update-tests
/tmp/pixel-volume-update-tests tests/fixtures
```

测试使用每次新建的临时密钥，覆盖签名篡改、未知密钥、非 HTTPS、错误域名／路径／哈希、大小限制、通道、协议版本和版本比较。无 GUI 点击、音量修改或权限申请。

## 许可与署名

项目宿主与更新代码使用 MIT 许可。像素界面基于 @Lattice_Node 的 [Slider Resident](https://ludion.ai/p/slider-resident)，保留其 MIT 署名。随包依赖许可位于 `licenses/`，Mac 界面许可也包含于 App 资源内。
