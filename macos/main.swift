import AppKit
import ApplicationServices
import WebKit
import CoreServices

final class HudWebView: WKWebView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override var isOpaque: Bool { false }
}

final class VolumeApp: NSObject, NSApplicationDelegate, NSMenuDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    private let audio = AudioOutput()
    private let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 348, height: 148),
                                styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: true)
    private let loginItem = NSMenuItem(title: "登录时启动", action: #selector(toggleLogin), keyEquivalent: "")
    private let permissionItem = NSMenuItem(title: "启用键盘音量键…", action: #selector(requestPermission), keyEquivalent: "")
    private let sceneMenu = NSMenu(title: "场景")
    private let scenes = SceneLibrary()
    private var sceneID = SceneLibrary.room.id
    private var statusItem: NSStatusItem!
    private var web: HudWebView!
    private var timer: Timer?
    private var permissionTimer: Timer?
    private var ready = false
    private var dragging = false
    private var dismissAt = 0.0
    private var lastState: VolumeState?
    private var welcome: WelcomeWindow?
    private let appUpdater = AppUpdater()
    private let updateItem = NSMenuItem(title: "检查更新…", action: #selector(manualUpdateCheck), keyEquivalent: "")
    private var checkingUpdate = false
    private var updateStatus = "当前版本 \(UpdateClient.currentVersion)"

    private lazy var launchedAtLogin: Bool = {
        if UserDefaults.standard.bool(forKey: "PixelUpdateRelaunchPending") {
            UserDefaults.standard.removeObject(forKey: "PixelUpdateRelaunchPending")
            return true
        }
        if ProcessInfo.processInfo.arguments.contains("--login") { return true }
        let reason = NSAppleEventManager.shared().currentAppleEvent?
            .paramDescriptor(forKeyword: keyAEPropData)?.enumCodeValue
        return reason == keyAELaunchedAsLogInItem || reason == keyAELaunchedAsServiceItem
    }()
    private lazy var keys = VolumeKeys { [weak self] key, fine in
        guard let self, self.ready, let state = self.audio.apply(key, fine: fine) else { return false }
        DispatchQueue.main.async { self.show(state, for: 2.5) }
        return true
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if #available(macOS 11, *) {
            statusItem.button?.image = NSImage(systemSymbolName: "speaker.wave.2", accessibilityDescription: "像素音量")
        } else {
            statusItem.button?.title = "🔊"
        }
        statusItem.button?.toolTip = "像素音量 · Pixel Volume"
        let menu = NSMenu()
        menu.delegate = self
        menu.addItem(withTitle: "打开音量浮窗", action: #selector(openVolume), keyEquivalent: "").target = self
        menu.addItem(withTitle: "设置与使用说明…", action: #selector(openWelcome), keyEquivalent: "").target = self
        let sceneItem = NSMenuItem(title: "场景", action: nil, keyEquivalent: "")
        sceneItem.submenu = sceneMenu
        menu.addItem(sceneItem)
        menu.addItem(updateItem)
        updateItem.target = self
        menu.addItem(permissionItem)
        permissionItem.target = self
        menu.addItem(loginItem)
        loginItem.target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "退出像素音量", action: #selector(quit), keyEquivalent: "q").target = self
        statusItem.menu = menu
        appUpdater.onStatus = { [weak self] status, busy in
            guard let self else { return }
            self.updateStatus = status
            self.checkingUpdate = busy
            self.updateItem.title = status.hasPrefix("发现新版本") ? status : "检查更新…"
            self.updateWelcome()
        }
        appUpdater.start()

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.add(self, name: "pixelVolume")
        #if PIXEL_TEST
        if Bundle.main.object(forInfoDictionaryKey: "PixelTestLegacyCanvas") as? Bool == true {
            let legacy = """
                const canvasContext = HTMLCanvasElement.prototype.getContext;
                HTMLCanvasElement.prototype.getContext = function (kind, ...options) {
                    return kind === 'webgl2' ? null : canvasContext.call(this, kind, ...options);
                };
                window.OffscreenCanvas = undefined;
                CanvasRenderingContext2D.prototype.roundRect = undefined;
                Array.prototype.at = undefined;
                MediaQueryList.prototype.addEventListener = undefined;
                """
            config.userContentController.addUserScript(WKUserScript(source: legacy, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        #endif
        web = HudWebView(frame: panel.frame, configuration: config)
        web.navigationDelegate = self
        if #available(macOS 12, *) { web.underPageBackgroundColor = .clear }
        // WebKit exposes _setDrawsBackground: on macOS; the public-looking
        // selector does not exist and previously left the backing page opaque.
        if web.responds(to: NSSelectorFromString("_setDrawsBackground:")) {
            web.setValue(false, forKey: "drawsBackground")
        }
        panel.contentView = web
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.becomesKeyOnlyIfNeeded = true
        panel.level = .statusBar
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient, .ignoresCycle]

        guard let source = readResource("SliderResident"), let bridge = readResource("DesktopBridge"),
              let host = readResource("SceneHost"), let village = readResource("Village.bundle", ext: "js"),
              let posters = readResource("VillagePosters", ext: "js") else { return }
        let head = """
            <!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>像素音量</title>
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; frame-src about:; base-uri 'none'; form-action 'none'">
            </head><body>
            """
        web.loadHTMLString(head + "<script>" + village + "</script><script>" + posters + "</script>" + host + source + bridge + "</body></html>", baseURL: nil)
        if !launchedAtLogin {
            openWelcome()
            let promptedKey = "KeyboardPermissionOnboardingPrompted"
            if !AXIsProcessTrusted(), !UserDefaults.standard.bool(forKey: promptedKey) {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
                    guard let self, self.welcome?.window?.isVisible == true else { return }
                    UserDefaults.standard.set(true, forKey: promptedKey)
                    self.beginKeyboardPermission(openSettings: false)
                }
            }
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        openWelcome()
        return false
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        if ready { _ = keys.start() }
        updateWelcome()
    }

    @objc private func openWelcome() {
        if welcome == nil {
            let window = WelcomeWindow()
            window.preview = { [weak self] in self?.openVolume() }
            window.enableKeys = { [weak self] in self?.requestPermission() }
            window.toggleLogin = { [weak self] in self?.toggleLogin() }
            window.checkUpdates = { [weak self] in self?.checkUpdates(manual: true) }
            welcome = window
        }
        updateWelcome()
        welcome?.present()
    }

    private func updateWelcome() {
        welcome?.update(ready: ready, keyboardActive: ready && keys.active, login: LoginStartup.state)
        welcome?.setUpdateStatus(updateStatus, busy: checkingUpdate)
    }

    @objc private func manualUpdateCheck() { checkUpdates(manual: true) }

    private func checkUpdates(manual: Bool) {
        if manual { appUpdater.check() }
    }

    private func readResource(_ name: String, ext: String = "html") -> String? {
        guard let url = Bundle.main.url(forResource: name, withExtension: ext) else { return nil }
        return try? String(contentsOf: url, encoding: .utf8)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let target = action.targetFrame, action.navigationType == .other,
              let url = action.request.url?.absoluteString else { decisionHandler(.cancel); return }
        let allowed = url == "about:blank" || (!target.isMainFrame && url == "about:srcdoc")
        decisionHandler(allowed ? .allow : .cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        ready = false
        keys.stop()
        panel.orderOut(nil)
        webView.reload()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "pixelVolume", message.frameInfo.isMainFrame,
              let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "ready":
            guard !ready else { return }
            ready = true
            restoreScene()
            _ = keys.start()
            updateWelcome()
            if ProcessInfo.processInfo.arguments.contains("--preview") { openVolume() }
            #if PIXEL_TEST
            if ProcessInfo.processInfo.arguments.contains("--verify-launch") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { self.runLaunchVerification() }
            } else {
                runVerification()
            }
            #endif
        case "volume":
            guard ready, panel.isVisible, let level = body["level"] as? Int, (0...100).contains(level) else { return }
            let state = audio.set(Float32(level) / 100)
            if let state, !state.muted, Int((state.level * 100).rounded()) == level {
                lastState = state
            } else {
                push(state, force: true)
            }
            keepOpen(dragging ? 20 : 2.5)
        case "drag-start":
            guard panel.isVisible else { return }
            dragging = true
            keepOpen(20)
        case "drag-end":
            dragging = false
            keepOpen(2.5)
        default:
            break
        }
    }

    @objc private func openVolume() {
        guard ready else { return }
        show(audio.read(), for: 8)
    }

    private func show(_ state: VolumeState?, for seconds: Double) {
        if !panel.isVisible, let screen = NSScreen.screens.first(where: { $0.frame.contains(NSEvent.mouseLocation) }) ?? NSScreen.main {
            let area = screen.visibleFrame
            panel.setFrameOrigin(NSPoint(x: area.midX - panel.frame.width / 2, y: area.minY + 14))
        }
        let wasHidden = !panel.isVisible
        panel.orderFrontRegardless()
        push(state, force: wasHidden)
        if wasHidden { setSceneVisibility(true) }
        keepOpen(seconds)
        if timer == nil {
            let refresh = Timer(timeInterval: 0.18, repeats: true) { [weak self] _ in self?.refresh() }
            RunLoop.main.add(refresh, forMode: .common)
            timer = refresh
        }
    }

    private func keepOpen(_ seconds: Double) { dismissAt = ProcessInfo.processInfo.systemUptime + seconds }

    private func refresh() {
        if ProcessInfo.processInfo.systemUptime >= dismissAt {
            panel.orderOut(nil)
            setSceneVisibility(false)
            dragging = false
            timer?.invalidate()
            timer = nil
        } else if !dragging {
            push(audio.read())
        }
    }

    private func push(_ state: VolumeState?, force: Bool = false) {
        guard force || state != lastState else { return }
        lastState = state
        let value = state?.webValue ?? ["available": false]
        guard let data = try? JSONSerialization.data(withJSONObject: value) else { return }
        let json = String(decoding: data, as: UTF8.self)
        web.evaluateJavaScript("window.setPixelVolume(\(json))", completionHandler: nil)
    }

    func menuWillOpen(_ menu: NSMenu) {
        populateSceneMenu()
        let active = ready && keys.start()
        permissionItem.title = active ? "键盘音量键已接管" : "启用键盘音量键…"
        permissionItem.state = active ? .on : .off
        let login = LoginStartup.state
        loginItem.state = login == .off ? .off : .on
        loginItem.title = login == .needsApproval ? "登录时启动（等待系统确认）" : "登录时启动"
        updateWelcome()
    }

    private func populateSceneMenu() {
        sceneMenu.removeAllItems()
        let entries = [SceneLibrary.room, SceneLibrary.village] + ((try? scenes.imported()) ?? [])
        for entry in entries {
            let item = sceneMenu.addItem(withTitle: entry.title, action: #selector(pickScene(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = entry.id
            item.state = entry.id == sceneID ? .on : .off
        }
        sceneMenu.addItem(.separator())
        sceneMenu.addItem(withTitle: "导入 HTML 场景…", action: #selector(importScene), keyEquivalent: "").target = self
        if sceneID != SceneLibrary.room.id && sceneID != SceneLibrary.village.id {
            sceneMenu.addItem(withTitle: "移除当前导入场景", action: #selector(removeScene), keyEquivalent: "").target = self
        }
    }

    @objc private func pickScene(_ sender: NSMenuItem) {
        guard let id = sender.representedObject as? String else { return }
        changeSceneFiles { try chooseScene(id) }
    }

    @objc private func importScene() {
        let picker = NSOpenPanel()
        picker.title = "导入 HTML 场景"
        picker.message = "请选取一个资源已经内嵌的 HTML 文件。"
        picker.allowedFileTypes = ["html", "htm"]
        NSApp.activate(ignoringOtherApps: true)
        guard picker.runModal() == .OK, let url = picker.url else { return }
        changeSceneFiles { try chooseScene(scenes.add(url).id) }
    }

    @objc private func removeScene() {
        changeSceneFiles {
            let removed = sceneID
            try chooseScene(SceneLibrary.room.id)
            try scenes.remove(removed)
        }
    }

    private func chooseScene(_ id: String) throws {
        let content = try scenes.load(id)
        try scenes.remember(id)
        sceneID = id
        sendScene(content)
        openVolume()
    }

    private func restoreScene() {
        let id = scenes.selectedID()
        if let content = try? scenes.load(id) {
            sceneID = id
            sendScene(content)
        } else {
            sceneID = SceneLibrary.room.id
            sendScene(SceneContent(kind: sceneID))
        }
    }

    private func sendScene(_ content: SceneContent) {
        guard ready else { return }
        var value: [String: String] = ["kind": content.kind]
        if let html = content.html { value["html"] = html }
        guard let data = try? JSONSerialization.data(withJSONObject: value) else { return }
        let json = String(decoding: data, as: UTF8.self)
        web.evaluateJavaScript("window.setPixelScene(\(json))", completionHandler: nil)
    }

    private func setSceneVisibility(_ visible: Bool) {
        web.evaluateJavaScript("window.setPixelSceneVisibility(\(visible))", completionHandler: nil)
    }

    private func changeSceneFiles(_ action: () throws -> Void) {
        do { try action() }
        catch {
            let alert = NSAlert(error: error)
            alert.messageText = "场景文件无法读取或保存"
            alert.runModal()
        }
    }

    @objc private func requestPermission() {
        beginKeyboardPermission(openSettings: true)
    }

    private func beginKeyboardPermission(openSettings: Bool) {
        if keys.active { return }
        let prompt = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        if AXIsProcessTrustedWithOptions(prompt), ready, keys.start() { updateWelcome(); return }
        if openSettings, let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
            NSWorkspace.shared.open(url)
        }
        permissionTimer?.invalidate()
        let deadline = ProcessInfo.processInfo.systemUptime + 90
        permissionTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            if (self.ready && self.keys.start()) || ProcessInfo.processInfo.systemUptime >= deadline {
                self.updateWelcome()
                timer.invalidate()
                self.permissionTimer = nil
            }
        }
    }

    @objc private func toggleLogin() {
        do {
            try LoginStartup.toggle()
        } catch {
            let alert = NSAlert(error: error)
            alert.messageText = "无法修改登录启动项"
            alert.runModal()
        }
        updateWelcome()
    }

    @objc private func quit() { NSApp.terminate(nil) }

    func applicationWillTerminate(_ notification: Notification) {
        keys.stop()
        permissionTimer?.invalidate()
        timer?.invalidate()
        web?.configuration.userContentController.removeScriptMessageHandler(forName: "pixelVolume")
    }

    #if PIXEL_TEST
    private func runLaunchVerification() {
        let folder = Bundle.main.bundleURL.deletingLastPathComponent()
        let name = Bundle.main.bundleURL.deletingPathExtension().lastPathComponent
        let isLogin = ProcessInfo.processInfo.arguments.contains("--login")
        let suffix = isLogin ? "-login" : "-launch"
        let initialVisible = welcome?.window?.isVisible ?? false
        let initialWindow = welcome?.window
        welcome?.close()
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        NSWorkspace.shared.openApplication(at: Bundle.main.bundleURL, configuration: configuration) { running, error in
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [self] in
                var screenshot = false
                if let view = welcome?.window?.contentView,
                   let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) {
                    view.cacheDisplay(in: view.bounds, to: bitmap)
                    if let png = bitmap.representation(using: .png, properties: [:]) {
                        do {
                            try png.write(to: folder.appendingPathComponent(name + suffix + ".png"))
                            screenshot = true
                        } catch {}
                    }
                }
                let values: [String: Any] = [
                    "loginLaunch": isLogin,
                    "initialWindowVisible": initialVisible,
                    "reopenWindowVisible": welcome?.window?.isVisible ?? false,
                    "reopenSameProcess": running?.processIdentifier == ProcessInfo.processInfo.processIdentifier,
                    "reusedWindow": initialWindow == nil || initialWindow === welcome?.window,
                    "reopenError": error?.localizedDescription ?? "",
                    "screenshot": screenshot,
                    "ready": ready,
                    "loginStatus": LoginStartup.state.rawValue
                ]
                if let data = try? JSONSerialization.data(withJSONObject: values, options: [.sortedKeys, .prettyPrinted]) {
                    try? data.write(to: folder.appendingPathComponent(name + suffix + ".json"))
                }
                NSApp.terminate(nil)
            }
        }
    }

    private func runVerification() {
        let folder = Bundle.main.bundleURL.deletingLastPathComponent().path
        let reportName = Bundle.main.bundleURL.deletingPathExtension().lastPathComponent
        let result = URL(fileURLWithPath: folder).appendingPathComponent("\(reportName).json")
        let report: ([String: Any]) -> Void = { value in
            if let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .prettyPrinted]) {
                try? data.write(to: result, options: .atomic)
            }
            NSApp.terminate(nil)
        }
        guard let baseline = audio.read() else { report(["ready": true, "audio": "unsupported"]); return }
        show(baseline, for: 8)
        let start = Int((baseline.level * 100).rounded())
        let target = start >= 5 ? start - 4 : start + 4
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [self] in
            web.evaluateJavaScript("""
                (() => {
                const slider = document.querySelector('.range');
                slider.value = \(target);
                slider.dispatchEvent(new Event('input'));
                const canvas = document.querySelector('.scene');
                const context = canvas.getContext('2d');
                let painted = null;
                if (context) {
                    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
                    painted = false;
                    for (let i = 3; i < pixels.length; i += 4) {
                        if (pixels[i] !== 0) { painted = true; break; }
                    }
                }
                return { width: canvas.width, painted };
                })()
                """) { [self] outcome, _ in
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [self] in
                    let changed = audio.read()
                    let keysProbe = VolumeKeys { key, fine in self.audio.apply(key, fine: fine) != nil }
                    let key = target >= 7 ? VolumeKey.down : .up
                    let accepted = [0xa, 0xb].map { state in
                        NSEvent.otherEvent(with: .systemDefined, location: .zero, modifierFlags: [], timestamp: 0,
                                           windowNumber: 0, context: nil, subtype: 8,
                                           data1: (key.rawValue << 16) | (state << 8), data2: 0).map(keysProbe.handle) ?? false
                    }
                    let keyLevel = audio.read().map { Int(($0.level * 100).rounded()) } ?? -1
                    let restored = audio.restore(baseline)
                    let stats = outcome as? [String: Any] ?? [:]
                    let loginStatus = LoginStartup.state.rawValue
                    web.takeSnapshot(with: nil) { image, _ in
                        let png = image?.tiffRepresentation.flatMap { NSBitmapImageRep(data: $0) }?
                            .representation(using: .png, properties: [:])
                        try? png?.write(to: result.deletingPathExtension().appendingPathExtension("png"))
                        #if arch(x86_64)
                        let architecture = "x86_64"
                        #else
                        let architecture = "arm64"
                        #endif
                        report(["ready": true, "start": start, "target": target,
                                "actual": changed.map { Int(($0.level * 100).rounded()) } ?? -1,
                                "restored": restored, "canvas": stats["width"] ?? 0, "snapshot": png != nil,
                                "painted2D": stats["painted"] ?? NSNull(), "architecture": architecture,
                                "keyDecoderAccepted": accepted, "keyLevel": keyLevel,
                                "keyAccess": AXIsProcessTrusted(), "loginStatus": loginStatus])
                    }
                }
            }
        }
    }
    #endif
}

// A headless check never creates AppKit windows or requests audio/key permissions.
if CommandLine.arguments.count == 2 && CommandLine.arguments[1] == "--check-update" {
    let checker = UpdateClient()
    var finished = false
    var status: Int32 = 2
    checker.check { result in
        DispatchQueue.main.async {
            switch result {
            case .success(let release):
                let value: [String: Any] = ["current": UpdateClient.currentVersion, "latest": release.version,
                    "updateAvailable": release.isNewer, "signatureVerified": true,
                    "url": release.download.absoluteString, "sha256": release.sha256]
                if let json = try? JSONSerialization.data(withJSONObject: value, options: .sortedKeys) {
                    print(String(data: json, encoding: .utf8)!)
                    status = 0
                }
            case .failure: print("Update check failed")
            }
            finished = true
        }
    }
    while !finished { RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.1)) }
    exit(status)
}
let app = NSApplication.shared
let delegate = VolumeApp()
app.setActivationPolicy(.accessory)
app.delegate = delegate
app.run()
