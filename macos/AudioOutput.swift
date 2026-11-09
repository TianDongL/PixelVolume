import AudioToolbox
import CoreAudio

struct VolumeState: Equatable {
    let level: Float32
    let muted: Bool

    var webValue: [String: Any] {
        ["level": Int((level * 100).rounded()), "muted": muted, "available": true]
    }
}

enum VolumeKey: Int {
    case up = 0
    case down = 1
    case mute = 7
}

struct AudioOutput {
    private struct Device {
        let id: AudioObjectID
        let volume: AudioObjectPropertyAddress
        let mute: AudioObjectPropertyAddress?
    }

    func read() -> VolumeState? {
        currentDevice().flatMap(read)
    }

    func set(_ level: Float32) -> VolumeState? {
        guard let device = currentDevice(), let before = read(device) else { return nil }
        return set(level, on: device, previous: before)
    }

    func apply(_ key: VolumeKey, fine: Bool) -> VolumeState? {
        guard let device = currentDevice(), let before = read(device) else { return nil }
        if key == .mute {
            guard let mute = device.mute, write(device.id, mute, UInt32(before.muted ? 0 : 1)) else { return nil }
            return read(device) ?? VolumeState(level: before.level, muted: !before.muted)
        }

        let steps: Float32 = fine ? 64 : 16
        let index = before.level * steps
        let next = key == .up ? (index + 0.001).rounded(.down) + 1 : (index - 0.001).rounded(.up) - 1
        return set(min(1, max(0, next / steps)), on: device, previous: before)
    }

    private func set(_ level: Float32, on device: Device, previous: VolumeState) -> VolumeState? {
        if abs(previous.level - level) > 0.0001, !write(device.id, device.volume, level) { return nil }
        var muted = previous.muted
        if level > 0, muted, let mute = device.mute, write(device.id, mute, UInt32(0)) { muted = false }
        return read(device) ?? VolumeState(level: level, muted: muted)
    }

    private func currentDevice() -> Device? {
        let output = address(kAudioHardwarePropertyDefaultOutputDevice, scope: kAudioObjectPropertyScopeGlobal)
        guard let id = read(AudioObjectID(kAudioObjectSystemObject), output, initial: AudioObjectID(0)), id != 0 else { return nil }
        let candidates = [kAudioHardwareServiceDeviceProperty_VirtualMainVolume, kAudioDevicePropertyVolumeScalar]
        for selector in candidates {
            var volume = address(selector)
            if canWrite(id, &volume), read(id, volume, initial: Float32(0)) != nil {
                var mute = address(kAudioDevicePropertyMute)
                return Device(id: id, volume: volume, mute: canWrite(id, &mute) ? mute : nil)
            }
        }
        return nil
    }

    private func read(_ device: Device) -> VolumeState? {
        guard let level = read(device.id, device.volume, initial: Float32(0)), level.isFinite else { return nil }
        let mute = device.mute.flatMap { read(device.id, $0, initial: UInt32(0)) } ?? 0
        return VolumeState(level: min(1, max(0, level)), muted: mute != 0)
    }

    #if PIXEL_TEST
    func restore(_ state: VolumeState) -> Bool {
        guard let device = currentDevice(), write(device.id, device.volume, state.level) else { return false }
        if let mute = device.mute, !write(device.id, mute, UInt32(state.muted ? 1 : 0)) { return false }
        return read(device) == state
    }
    #endif

    private func address(_ selector: AudioObjectPropertySelector, scope: AudioObjectPropertyScope = kAudioDevicePropertyScopeOutput)
        -> AudioObjectPropertyAddress {
        AudioObjectPropertyAddress(mSelector: selector, mScope: scope, mElement: kAudioObjectPropertyElementMain)
    }

    private func canWrite(_ id: AudioObjectID, _ property: inout AudioObjectPropertyAddress) -> Bool {
        var settable: DarwinBoolean = false
        return AudioObjectHasProperty(id, &property)
            && AudioObjectIsPropertySettable(id, &property, &settable) == noErr && settable.boolValue
    }

    private func read<T>(_ id: AudioObjectID, _ property: AudioObjectPropertyAddress, initial: T) -> T? {
        var property = property
        var result = initial
        var size = UInt32(MemoryLayout<T>.size)
        let status = withUnsafeMutableBytes(of: &result) {
            AudioObjectGetPropertyData(id, &property, 0, nil, &size, $0.baseAddress!)
        }
        return status == noErr ? result : nil
    }

    private func write<T>(_ id: AudioObjectID, _ property: AudioObjectPropertyAddress, _ value: T) -> Bool {
        var property = property
        return withUnsafeBytes(of: value) {
            AudioObjectSetPropertyData(id, &property, 0, nil, UInt32($0.count), $0.baseAddress!) == noErr
        }
    }
}
