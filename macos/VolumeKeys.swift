import AppKit
import ApplicationServices

final class VolumeKeys {
    private var tap: CFMachPort?
    private var source: CFRunLoopSource?
    private var swallowed: Set<VolumeKey> = []
    private let onKey: (VolumeKey, Bool) -> Bool

    var active: Bool { tap.map { CGEvent.tapIsEnabled(tap: $0) } ?? false }

    init(onKey: @escaping (VolumeKey, Bool) -> Bool) {
        self.onKey = onKey
    }

    func start() -> Bool {
        if active { return true }
        stop()
        guard AXIsProcessTrusted() else { return false }
        let mask = CGEventMask(1) << NSEvent.EventType.systemDefined.rawValue
        guard let port = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap,
                options: .defaultTap, eventsOfInterest: mask, callback: Self.receive,
                userInfo: Unmanaged.passUnretained(self).toOpaque()),
              let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, port, 0) else { return false }
        tap = port
        source = runLoopSource
        CFRunLoopAddSource(CFRunLoopGetMain(), runLoopSource, .commonModes)
        CGEvent.tapEnable(tap: port, enable: true)
        return active
    }

    func stop() {
        if let source { CFRunLoopRemoveSource(CFRunLoopGetMain(), source, .commonModes) }
        if let tap { CFMachPortInvalidate(tap) }
        source = nil
        tap = nil
        swallowed.removeAll()
    }

    private static let receive: CGEventTapCallBack = { _, type, event, context in
        guard let context else { return Unmanaged.passUnretained(event) }
        let keys = Unmanaged<VolumeKeys>.fromOpaque(context).takeUnretainedValue()
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            if let tap = keys.tap, AXIsProcessTrusted() { CGEvent.tapEnable(tap: tap, enable: true) }
            return Unmanaged.passUnretained(event)
        }
        if let mediaEvent = NSEvent(cgEvent: event), keys.handle(mediaEvent) { return nil }
        return Unmanaged.passUnretained(event)
    }

    func handle(_ event: NSEvent) -> Bool {
        guard event.type == .systemDefined, event.subtype.rawValue == 8,
              let key = VolumeKey(rawValue: (event.data1 >> 16) & 0xffff) else { return false }
        let state = (event.data1 >> 8) & 0xff
        if state == 0xb { return swallowed.remove(key) != nil }
        guard state == 0xa else { return false }
        if key == .mute, event.data1 & 1 != 0 { return swallowed.contains(key) }
        // Option alone opens the Sound pane in macOS. Option + Shift adjusts in finer steps.
        let fine = event.modifierFlags.contains([.option, .shift])
        if event.modifierFlags.contains(.option), !fine { return false }
        guard onKey(key, fine) else { return false }
        swallowed.insert(key)
        return true
    }
}
