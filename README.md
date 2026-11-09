# 像素音量 · Pixel Volume

把键盘音量键和系统默认输出设备的音量控制，放进一个像素房间浮窗。

- Windows：WPF、WebView2、Core Audio，支持 Windows 10 2004 及以上 x64。
- macOS：AppKit、WKWebView、Core Audio，通用二进制同时包含 Intel x86_64 和 Apple arm64；最低构建目标分别为 macOS 10.15.7 和 11.0。
- 首次打开提供使用引导；登录启动默认关闭，由用户选择。
- Mac 首次使用引导用户允许辅助功能权限，以接管键盘音量键。
- 启动时及运行中每六小时检查更新；设置窗口和系统托盘／菜单栏也提供「检查更新」。从 0.2.6 开始，在应用内下载、校验并安装，确认后重启，不需要打开浏览器。

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
| `website/` | Norgate 下载页、双端安装说明及浏览器效果预览 |

下载页构建：`python scripts/build_website.py --release artifacts/site/release.json --out artifacts/site`。它复用应用的像素界面生成网页预览，页面不接管系统音量；版本、下载地址、大小与校验值从发布元数据生成，并可在页面打开时刷新。部署网页时只替换 `index.html` 和 `assets/`，保留安装包与签名更新通道。

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

该签名清单继续服务 Windows 与旧版 Mac。Windows 使用内置 P-256 公钥验证清单，并在应用内流式下载，核对大小与 SHA-256；用户选择“重启并更新”后，安装器等待旧进程退出、保留旧文件直至完成替换，再启动新版。

Mac 0.2.6 起使用同一服务器上的 `updates/appcast.xml`，由同一份双端发布元数据生成，采用 Sparkle 2.9.6 的原生下载、安装与重启界面。清单和安装包均需 Ed25519 签名，安装包继续使用 Developer ID 签名与 Apple 公证。后台只检查并在菜单提示，安装需用户确认。保留 Intel 10.15.7／Apple 芯片 11.0 构建目标；没有采用要求 macOS 12 的 Sparkle 2.10。

这是全量包自更新，暂未启用差分下载。0.2.5 及以前版本需要按原有方式手动安装一次 0.2.6，之后的新版本即可在应用内完成更新。

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

测试使用每次新建的临时密钥，覆盖签名篡改、未知密钥、非 HTTPS、错误域名／路径／哈希、大小限制、通道、协议版本和版本比较。Windows 还测试下载完整性、缓存篡改、取消和重定向；`tests/test-installer.ps1 -NsisCompiler <path>` 用独立临时目录及无执行功能的文件测试安装替换和失败保留，不改真实安装或注册表。无 GUI 点击、音量修改或权限申请。

## 许可与署名

项目宿主与更新代码使用 MIT 许可。像素界面基于 @Lattice_Node 的 [Slider Resident](https://ludion.ai/p/slider-resident)，保留其 MIT 署名。随包依赖许可位于 `licenses/`，Mac 界面和 Sparkle 许可也包含于 App 资源内。
