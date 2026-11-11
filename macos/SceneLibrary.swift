import Foundation

struct SceneEntry {
    let id: String
    let title: String
}

struct SceneContent {
    let kind: String
    var html: String? = nil
}

enum SceneFileError: LocalizedError {
    case missing, tooLarge, encoding, empty

    var errorDescription: String? {
        switch self {
        case .missing: return "找不到这个导入场景。"
        case .tooLarge: return "场景 HTML 需小于或等于 8 MB。"
        case .encoding: return "请将场景保存为 UTF-8 编码的 HTML。"
        case .empty: return "场景 HTML 为空。"
        }
    }
}

struct SceneLibrary {
    static let room = SceneEntry(id: "room", title: "像素房间")
    static let village = SceneEntry(id: "village", title: "雾溪村")
    private static let maximumBytes = 8 * 1024 * 1024
    let directory: URL
    private var selectedFile: URL { directory.appendingPathComponent("selected") }

    init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("PixelVolume/Scenes", isDirectory: true)
    }

    func imported() throws -> [SceneEntry] {
        guard FileManager.default.fileExists(atPath: directory.path) else { return [] }
        return try FileManager.default.contentsOfDirectory(atPath: directory.path)
            .compactMap { entry($0) }
            .sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }

    func selectedID() -> String {
        (try? String(contentsOf: selectedFile, encoding: .utf8)) ?? Self.room.id
    }

    func load(_ id: String) throws -> SceneContent {
        if id == Self.room.id || id == Self.village.id { return SceneContent(kind: id) }
        return try SceneContent(kind: "html", html: readHTML(importedURL(id)))
    }

    func remember(_ id: String) throws { try write(id, to: selectedFile) }

    func add(_ url: URL) throws -> SceneEntry {
        let html = try readHTML(url)
        let name = url.deletingPathExtension().lastPathComponent.trimmingCharacters(in: .whitespacesAndNewlines)
        var title = ""
        for character in name {
            if title.utf8.count + String(character).utf8.count > 180 { break }
            title.append(character)
        }
        if title.isEmpty { title = "导入场景" }
        let id = UUID().uuidString.lowercased() + "-" + title + ".html"
        try write(html, to: directory.appendingPathComponent(id))
        return SceneEntry(id: id, title: title)
    }

    func remove(_ id: String) throws { try FileManager.default.removeItem(at: importedURL(id)) }

    private func importedURL(_ id: String) throws -> URL {
        guard entry(id) != nil else { throw SceneFileError.missing }
        return directory.appendingPathComponent(id)
    }

    private func entry(_ id: String) -> SceneEntry? {
        guard !id.contains("/"), id.count >= 43, id.hasSuffix(".html"),
              UUID(uuidString: String(id.prefix(36))) != nil, id.dropFirst(36).first == "-" else { return nil }
        return SceneEntry(id: id, title: String(id.dropFirst(37).dropLast(5)))
    }

    private func readHTML(_ url: URL) throws -> String {
        guard try url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile == true else {
            throw SceneFileError.missing
        }
        let file = try FileHandle(forReadingFrom: url)
        defer { try? file.close() }
        let data = try file.read(upToCount: Self.maximumBytes + 1) ?? Data()
        guard data.count <= Self.maximumBytes else { throw SceneFileError.tooLarge }
        guard var html = String(data: data, encoding: .utf8) else { throw SceneFileError.encoding }
        if html.hasPrefix("\u{FEFF}") { html.removeFirst() }
        guard !html.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw SceneFileError.empty }
        return html
    }

    private func write(_ text: String, to url: URL) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try text.write(to: url, atomically: true, encoding: .utf8)
    }
}
