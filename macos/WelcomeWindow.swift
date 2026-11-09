import AppKit

final class WelcomeWindow: NSWindowController {
    var preview: (() -> Void)?
    var enableKeys: (() -> Void)?
    var toggleLogin: (() -> Void)?
    var checkUpdates: (() -> Void)?
    private let updateLabel = NSTextField(labelWithString: "")
    private let updateButton = NSButton(title: "检查更新", target: nil, action: nil)

    private let readyLabel = NSTextField(labelWithString: "正在准备像素浮窗…")
    private let titleLabel = NSTextField(labelWithString: "先开启键盘音量键")
    private let introLabel = NSTextField(wrappingLabelWithString: "")
    private let permissionLabel = NSTextField(labelWithString: "等待你在系统设置中允许")
    private let doneButton = NSButton(title: "稍后设置", target: nil, action: nil)
    private let previewButton = NSButton(title: "预览音量浮窗", target: nil, action: nil)
    private let keysButton = NSButton(title: "打开辅助功能设置", target: nil, action: nil)
    private let loginButton = NSButton(checkboxWithTitle: "登录时自动启动", target: nil, action: nil)
    private let loginLabel = NSTextField(labelWithString: "默认关闭，可随时在这里或菜单栏中更改。")

    init() {
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 540, height: 478),
                              styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "像素音量 · 设置与使用"
        window.isReleasedWhenClosed = false
        super.init(window: window)
        guard let content = window.contentView else { return }

        func label(_ text: String, _ frame: NSRect, _ size: CGFloat = 13, _ color: NSColor = .labelColor) {
            let field = NSTextField(wrappingLabelWithString: text)
            field.frame = frame
            field.font = .systemFont(ofSize: size)
            field.textColor = color
            content.addSubview(field)
        }
        titleLabel.frame = NSRect(x: 32, y: 365, width: 400, height: 32)
        titleLabel.font = .systemFont(ofSize: 24, weight: .semibold)
        content.addSubview(titleLabel)
        label(UpdateClient.currentVersion, NSRect(x: 456, y: 372, width: 52, height: 20), 12, .secondaryLabelColor)
        introLabel.frame = NSRect(x: 32, y: 309, width: 476, height: 48)
        introLabel.font = .systemFont(ofSize: 13)
        introLabel.textColor = .secondaryLabelColor
        content.addSubview(introLabel)

        label("1. 允许辅助功能", NSRect(x: 32, y: 272, width: 476, height: 22), 15)
        label("在系统设置的「辅助功能」列表中，打开「像素音量」的开关。",
              NSRect(x: 32, y: 242, width: 476, height: 26), 12, .secondaryLabelColor)
        keysButton.frame = NSRect(x: 26, y: 204, width: 200, height: 34)
        keysButton.bezelStyle = .rounded
        keysButton.target = self
        keysButton.action = #selector(requestKeys)
        keysButton.keyEquivalent = "\r"
        content.addSubview(keysButton)
        permissionLabel.frame = NSRect(x: 236, y: 213, width: 272, height: 20)
        permissionLabel.font = .systemFont(ofSize: 12)
        permissionLabel.textColor = .secondaryLabelColor
        content.addSubview(permissionLabel)

        let separator = NSBox(frame: NSRect(x: 32, y: 188, width: 476, height: 1))
        separator.boxType = .separator
        content.addSubview(separator)
        label("2. 试一下像素音量", NSRect(x: 32, y: 158, width: 476, height: 22), 15)
        previewButton.frame = NSRect(x: 26, y: 118, width: 160, height: 34)
        previewButton.bezelStyle = .rounded
        previewButton.target = self
        previewButton.action = #selector(showPreview)
        previewButton.isEnabled = false
        content.addSubview(previewButton)
        readyLabel.frame = NSRect(x: 198, y: 126, width: 310, height: 20)
        readyLabel.textColor = .secondaryLabelColor
        readyLabel.font = .systemFont(ofSize: 12)
        content.addSubview(readyLabel)

        loginButton.frame = NSRect(x: 30, y: 81, width: 478, height: 26)
        loginButton.target = self
        loginButton.action = #selector(changeLogin)
        content.addSubview(loginButton)
        loginLabel.frame = NSRect(x: 49, y: 59, width: 459, height: 20)
        loginLabel.font = .systemFont(ofSize: 12)
        loginLabel.textColor = .secondaryLabelColor
        content.addSubview(loginLabel)

        doneButton.target = self
        doneButton.action = #selector(dismiss)
        doneButton.bezelStyle = .rounded
        doneButton.frame = NSRect(x: 411, y: 17, width: 103, height: 34)
        content.addSubview(doneButton)
        let quit = NSButton(title: "退出应用", target: NSApp, action: #selector(NSApplication.terminate(_:)))
        quit.bezelStyle = .rounded
        quit.frame = NSRect(x: 26, y: 20, width: 108, height: 34)
        content.addSubview(quit)
        // Keep the original onboarding layout; add one row above the footer.
        for view in content.subviews where view !== doneButton && view !== quit {
            view.frame.origin.y += 48
        }
        updateButton.frame = NSRect(x: 402, y: 61, width: 112, height: 32)
        updateButton.bezelStyle = .rounded
        updateButton.target = self
        updateButton.action = #selector(requestUpdate)
        content.addSubview(updateButton)
        updateLabel.frame = NSRect(x: 32, y: 68, width: 360, height: 20)
        updateLabel.font = .systemFont(ofSize: 12)
        updateLabel.textColor = .secondaryLabelColor
        content.addSubview(updateLabel)
        window.center()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func present() {
        showWindow(nil)
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
    }

    func update(ready: Bool, keyboardActive: Bool, login: LoginStartup.State) {
        titleLabel.stringValue = keyboardActive ? "音量键已准备好" : "先开启键盘音量键"
        introLabel.stringValue = keyboardActive
            ? "现在按键盘音量键，就会显示像素浮窗。关闭这个窗口后仍在菜单栏运行，再次双击应用可回到这里。"
            : "首次使用需要你允许辅助功能，才能用键盘音量键唤出像素浮窗。系统授权提示已准备好，请按下面的步骤完成。"
        previewButton.isEnabled = ready
        readyLabel.stringValue = ready ? "像素浮窗已就绪" : "正在准备像素浮窗…"
        keysButton.title = keyboardActive ? "辅助功能已开启" : "打开辅助功能设置"
        keysButton.isEnabled = !keyboardActive
        keysButton.keyEquivalent = keyboardActive ? "" : "\r"
        permissionLabel.stringValue = keyboardActive ? "已完成，可以直接使用音量键" : "等待你在系统设置中允许"
        doneButton.title = keyboardActive ? "完成" : "稍后设置"
        doneButton.keyEquivalent = keyboardActive ? "\r" : ""
        loginButton.state = login == .off ? .off : .on
        loginLabel.stringValue = login == .needsApproval ? "请在系统设置中确认登录启动项。" : "可随时在这里或菜单栏中更改。"
    }

    @objc private func showPreview() { preview?() }
    @objc private func requestKeys() { enableKeys?() }
    @objc private func changeLogin() { toggleLogin?() }
    @objc private func requestUpdate() { checkUpdates?() }
    func setUpdateStatus(_ text: String, busy: Bool) {
        updateLabel.stringValue = text
        updateButton.isEnabled = !busy
    }
    @objc private func dismiss() { close() }
}
