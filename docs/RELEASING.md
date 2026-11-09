# 双端发布

## 协议与信任

`stable.json` 是 envelope：`keyId`、`payload`、`signature`。payload 是原始 UTF-8 JSON 字节的 Base64；signature 是 ECDSA P-256 / SHA-256 的 64 字节 IEEE P1363（r||s）签名的 Base64。必须先验签再解释 payload。公钥采用 65 字节 X9.63 未压缩格式。

payload 的 schemaVersion 为 1，channel 为 stable，version 为三个数字组成的正式版本号。platforms 必须同时包含 windows-x64 和 macos-universal，各自包括 url、sha256、size。当前客户端只提示高于自身版本的更新，不进行自动降级。HTTPS 清单请求不跟随重定向、限制为 64 KiB，并设置超时。

下载文件采用 `/pixel-volume/releases/<version>/<sha256>/<filename>` 不可变路径。发布后不覆盖相同 URL 的二进制。Windows 与旧版 Mac 使用 `stable.json`；Mac 0.2.6 起使用 `appcast.xml`，两者必须来自同一份双端发布，最后连续切换。服务器提供清单时应使用 no-store，安装包可以使用长期 immutable 缓存。

## 准备版本

1. 同时修改 Windows 项目 Version、两端 UpdateClient 的版本常量、Mac 两份 Info.plist 的版本／构建号、NSIS 与随包说明版本。
2. 执行更新协议测试，构建 Windows 安装器和 Mac 通用 App。检查主程序及登录助手均含 arm64、x86_64，保持最低系统目标。
3. 在 Mac 本机签名、公证、附加票据并校验。不要导出 Apple 密码或私钥。使用 `scripts/package-macos.sh`，通过环境变量指定已有的 NOTARY_PROFILE；必要时指定 DEVELOPER_DIR。
4. 将两端最终安装包放到本地发布目录。Mac 必须在附加公证票据之后计算最终哈希。
5. 使用离线保存的更新签名私钥生成两端清单。私钥必须在仓库之外；需要维护者另行做安全备份。

```bash
python scripts/prepare_release.py --version 0.2.6 \
  --windows artifacts/PixelVolume-0.2.6-Windows-x64-Setup.exe \
  --macos artifacts/PixelVolume-0.2.6-macOS-Universal.dmg \
  --macos-signature artifacts/PixelVolume-0.2.6-macOS-Universal.dmg.ed25519 \
  --notes release-notes.txt --key /secure/path/update-signing-key.pem \
  --out artifacts/site
```

## Mac 应用内更新

Sparkle 固定为 2.9.6：2.10 将最低系统提高到 macOS 12，不符合 Intel 10.15.7 的范围。`fetch-sparkle.sh` 下载并校验固定 SHA-256，构建保留 Universal 架构、框架符号链接和依赖许可，嵌套程序／XPC 从内到外用同一 Developer ID 签名。

发布 Mac DMG 时，`package-macos.sh` 在公证和 stapler 完成之后，使用钥匙串账号 `pixel-volume-release` 的 Ed25519 私钥签署最终字节，生成 `.dmg.ed25519`。公钥在 Info.plist 和 update-channel.json 内；私钥不导出、不进仓库或服务器。

`prepare_release.py` 验证 DMG 的 Ed25519 签名，并由两端同一份发布元数据生成 `updates/appcast.xml`。把这个文件送到 Mac，执行：

```bash
bash scripts/sign-macos-feed.sh artifacts/site/updates/appcast.xml
```

取回签名后的原始 XML 字节再部署，签名后不得换行、格式化或修改。正式客户端强制先验证清单和安装包签名，再解包；不接受签名失效后的超时放行。`CFBundleVersion` 必须递增；用户显示版本和 `stable.json` 的 version 相同。

Windows 先验证 P-256 清单，下载过程限制大小、超时，不跟随重定向；完成后核对 SHA-256，启动安装器前再校验并锁定文件。NSIS 的 `/INAPPUPDATE` 等待当前应用退出、暂存新文件、保留旧文件直到替换成功，随后以 `--updated` 启动。开机启动选择和 WebView 用户目录保留。

这是应用内全量包更新，不是差分更新。0.2.5 及以前版本没有安装更新的代码，需要先手动装一次 0.2.6。

## 部署顺序

1. 只上传 `artifacts/site/releases/` 下的两个不可变文件到服务器独立的 pixel-volume 目录。
2. 对公开 HTTPS 地址完整下载，核对两端大小和 SHA-256；检查 Mac 公证、Windows 签名状态，不把上传成功当作发布验收。
3. 保存旧 stable.json、appcast.xml 与 release.json。先准备并验证两个不可变安装包；新 stable.json 与签名 appcast.xml 分别通过同一文件系统内的 rename 连续切换。两个请求可能在短暂窗口读到相邻版本，但每份清单只引用已验证的不可变包。不得只发布一个平台。
4. 更新下载页与公开 release.json，回读稳定清单，分别用两端实际构建的无界面检查入口验证。
5. Windows：`PixelVolume.exe --check-update-to result.json`。Mac：直接执行 App 内的 `Contents/MacOS/PixelVolume --check-update`。这两个入口均不显示应用窗口，也不接管音量或申请权限。
6. 记录代码提交、安装包哈希、Mac 公证结果和公开回读结果，再提供给用户。

下载页源码在 `website/`，执行 `python scripts/build_website.py --release artifacts/site/release.json --out artifacts/site` 生成带本次版本回退链接的页面及预览资源。页面会从同目录 `release.json` 刷新两端版本与链接，不需要修改 HTML 中的下载地址。单独改版网页时只部署 `index.html` 与 `assets/`，不覆盖 `release.json`、`updates/` 或 `releases/`。

需要完全独立于桌面应用的线上验证时，可运行 `dotnet run --project tests/UpdateTests.csproj -- --live`；Mac 可将 `macos/UpdateClient.swift` 与 `tests/live/main.swift` 编译为控制台程序后运行。这些程序直接复用产品的更新模块，不链接桌面 UI，不申请辅助功能权限，也不改动音量或登录启动项。

回滚需一起恢复旧的签名 stable.json、appcast.xml、release.json 及下载页。客户端不会自动降级已安装版本。保留旧不可变安装包，避免旧链接失效。

公开回读可执行 `python scripts/verify_release.py --download`。在切换指针之前，可用 `--manifest-file artifacts/site/updates/stable.json --download` 验证已上传的两个安装包。验证器检查清单签名，并完整流式下载两端文件核对大小和 SHA-256，不执行安装程序。

## 密钥维护

更新签名私钥只放维护者的受限目录。服务器和 GitHub 只保存公钥与签名清单。新建私钥不会自动受旧客户端信任；轮换密钥需要先发布能够信任新公钥的客户端版本。失去当前私钥时，不能用新密钥直接签署旧客户端接受的更新。

## 非点击验证

- `dotnet run --project tests/UpdateTests.csproj -- tests/fixtures`：签名协议、下载、缓存篡改、取消及重定向。
- `tests/test-installer.ps1 -NsisCompiler <path>`：在独立目录里用无执行功能的假文件验证首次写入、替换、锁定失败、保留恢复副本；不接触真实安装、启动项或产品注册表。
- Mac：协议测试分别编译为 arm64 与 x86_64，复核主程序、登录助手、Sparkle 框架和帮助程序的架构与最低系统版本，验证 Developer ID、公证、DMG 和 Ed25519 签名。
- 不通过点击、键盘或安装正式应用进行验收。完整用户安装及重启流程仍需人工试用；CI/控制台通过不代表真实 Intel 旧系统完成验收。

## OSS / CDN 分发（0.2.7 起）

- 安装包同时保留兼容旧客户端的服务器不可变 URL，并上传到 Pixel Volume 专用私有 OSS 桶的 `download/releases/pixel-volume/<version>/<sha256>/<filename>`，继续使用 `dl.norgateai.com` 下载地址。上传前核对桶 ACL 为 private、阻止公共访问已开启。桶名与运维凭据保留在部署环境，不能写入公开仓库或客户端。
- CDN 按路径选择专用 OSS 源站，使用仅能读取该桶 Pixel Volume 下载目录的 RAM 身份回源。其他产品的路径继续访问原源站；不得对共用下载域名开启可读取所有私有桶的全局授权。验收须确认 CDN 成功下载、OSS 匿名直连返回 403，并核对其他产品下载路径未受影响。
- `prepare_release.py` 生成兼容旧版的 `url` 与新版使用的 `cdnUrl`。网页、新版 Windows/Mac 协议模块优先使用 `cdnUrl`；Sparkle appcast 的 enclosure 使用 CDN URL。
- 上传前后核对大小和 SHA-256，禁止覆盖不可变对象。需要从公开 CDN 地址完整下载并核对哈希，确认 HTTPS、Range 响应和缓存后，再发布指针。源站链接保留，以免旧版清单校验或禁用重定向的下载器失败。
- Windows 0.2.6 及以前并不认识 `cdnUrl`，升到 0.2.7 的这一跳仍会使用原链路；用户可从已走 CDN 的网页手动安装 0.2.7。之后应用内更新使用 CDN。不能用 302 跳转代替这次兼容升级。
