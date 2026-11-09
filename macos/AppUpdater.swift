import AppKit
import Sparkle

/// Sparkle owns download, signature validation, transactional installation and relaunch.
/// Scheduled checks only update our menu; installation always requires user action.
final class AppUpdater: NSObject, SPUUpdaterDelegate, SPUStandardUserDriverDelegate {
    var onStatus: ((String, Bool) -> Void)?
    private lazy var controller = SPUStandardUpdaterController(startingUpdater: false,
        updaterDelegate: self, userDriverDelegate: self)

    func start() { controller.startUpdater() }

    func check() {
        onStatus?("正在检查更新…", false)
        NSApp.activate(ignoringOtherApps: true)
        controller.checkForUpdates(nil)
    }

    var supportsGentleScheduledUpdateReminders: Bool { true }

    func standardUserDriverShouldHandleShowingScheduledUpdate(_ update: SUAppcastItem,
                                                               andInImmediateFocus immediateFocus: Bool) -> Bool { false }

    func standardUserDriverWillHandleShowingUpdate(_ handleShowingUpdate: Bool,
                                                   forUpdate update: SUAppcastItem, state: SPUUserUpdateState) {
        onStatus?("发现新版本 \(update.displayVersionString)…", false)
    }

    func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        onStatus?("发现新版本 \(item.displayVersionString)…", false)
    }

    func updater(_ updater: SPUUpdater, didFinishUpdateCycleFor updateCheck: SPUUpdateCheck, error: Error?) {
        if let error = error as NSError? {
            if error.code == SUError.noUpdateError.rawValue {
                onStatus?("当前已是最新版本 \(UpdateClient.currentVersion)", false)
            } else {
                onStatus?("更新未完成，可稍后重新检查。", false)
            }
        }
    }

    func updaterWillRelaunchApplication(_ updater: SPUUpdater) {
        UserDefaults.standard.set(true, forKey: "PixelUpdateRelaunchPending")
    }
}
