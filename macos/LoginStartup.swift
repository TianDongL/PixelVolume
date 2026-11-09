import Foundation
import ServiceManagement

enum LoginStartup {
    enum State: String { case off, on, needsApproval }

    private static let helperID = "com.tiandong.pixelvolume.launcher"
    private static let legacyPreference = "LegacyLoginItemEnabled"

    static var state: State {
        if #available(macOS 13, *) {
            let statuses = modernServices.map(\.status)
            if statuses.contains(.enabled) { return .on }
            if statuses.contains(.requiresApproval) { return .needsApproval }
            return .off
        }
        return UserDefaults.standard.bool(forKey: legacyPreference) ? .on : .off
    }

    static func toggle() throws {
        if #available(macOS 13, *) {
            if state == .off {
                try SMAppService.mainApp.register()
                if state == .needsApproval { SMAppService.openSystemSettingsLoginItems() }
            } else {
                for service in modernServices where service.status == .enabled || service.status == .requiresApproval {
                    try service.unregister()
                }
            }
            return
        }

        let enable = state == .off
        guard SMLoginItemSetEnabled(helperID as CFString, enable) else {
            throw NSError(domain: "PixelVolume.LoginStartup", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "请将像素音量放入「应用程序」后重试。"
            ])
        }
        UserDefaults.standard.set(enable, forKey: legacyPreference)
    }

    @available(macOS 13, *)
    private static var modernServices: [SMAppService] {
        [.mainApp, .loginItem(identifier: helperID)]
    }
}
