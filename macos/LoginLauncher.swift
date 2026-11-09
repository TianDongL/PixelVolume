import AppKit

let launcherID = "com.tiandong.pixelvolume"
let parentApp = (0..<4).reduce(Bundle.main.bundleURL) { url, _ in url.deletingLastPathComponent() }
guard Bundle(url: parentApp)?.bundleIdentifier == launcherID else { exit(1) }
guard NSRunningApplication.runningApplications(withBundleIdentifier: launcherID).isEmpty else { exit(0) }

let configuration = NSWorkspace.OpenConfiguration()
configuration.activates = false
configuration.arguments = ["--login"]
NSWorkspace.shared.openApplication(at: parentApp, configuration: configuration) { _, error in
    exit(error == nil ? 0 : 1)
}
DispatchQueue.main.asyncAfter(deadline: .now() + 12) { exit(1) }
RunLoop.main.run()
