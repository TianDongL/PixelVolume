import Foundation
import CryptoKit

struct UpdateRelease {
    let version: String
    let notes: String
    let download: URL
    let sha256: String
    let size: Int64
    var isNewer: Bool { (try? UpdateClient.compareVersions(version, UpdateClient.currentVersion)) == 1 }
}

enum UpdateFailure: Error { case invalidManifest }

final class UpdateClient: NSObject, URLSessionDataDelegate {
    static let currentVersion = "0.2.5"
    static let endpoint = URL(string: "https://norgateai.com/pixel-volume/updates/stable.json")!
    static let keyId = "pixel-volume-p256-2026-01"
    static let publicKey = "BCStAYN3T5jfuDxNsYIJL9U4RTE5XOG8tpJ1yevbDJL1BkJQi+wUqCoyN/t1yaCNshSqygcUjl7/WNBZvsU9pn8="

    static func compareVersions(_ first: String, _ second: String) throws -> Int {
        func components(_ text: String) throws -> [Int] {
            guard text.range(of: #"\A(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\z"#, options: .regularExpression) != nil else { throw UpdateFailure.invalidManifest }
            return text.split(separator: ".").map { Int($0)! }
        }
        let a = try components(first), b = try components(second)
        for i in 0..<3 { if a[i] != b[i] { return a[i] > b[i] ? 1 : -1 } }
        return 0
    }

    static func parse(_ envelope: Data, publicKey: String = UpdateClient.publicKey) throws -> UpdateRelease {
        guard envelope.count <= 65536,
              let outer = try JSONSerialization.jsonObject(with: envelope) as? [String: Any],
              outer["keyId"] as? String == keyId,
              let payloadText = outer["payload"] as? String, let payload = Data(base64Encoded: payloadText),
              let signatureText = outer["signature"] as? String, let signatureData = Data(base64Encoded: signatureText),
              signatureData.count == 64 else { throw UpdateFailure.invalidManifest }
        let key = try P256.Signing.PublicKey(x963Representation: Data(base64Encoded: publicKey)!)
        let signature = try P256.Signing.ECDSASignature(rawRepresentation: signatureData)
        guard key.isValidSignature(signature, for: payload),
              let body = try JSONSerialization.jsonObject(with: payload) as? [String: Any],
              (body["schemaVersion"] as? NSNumber)?.intValue == 1,
              body["channel"] as? String == "stable",
              let version = body["version"] as? String,
              let notes = body["notes"] as? String, notes.count <= 4000,
              let platforms = body["platforms"] as? [String: Any],
              let platform = platforms["macos-universal"] as? [String: Any],
              let urlText = platform["url"] as? String, let url = URL(string: urlText),
              let hash = platform["sha256"] as? String,
              hash.range(of: #"\A[a-f0-9]{64}\z"#, options: .regularExpression) != nil,
              let size = platform["size"] as? NSNumber, size.int64Value > 0, size.int64Value <= 1073741824,
              url.scheme == "https", url.host == "norgateai.com", url.port == nil || url.port == 443,
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              url.path == "/pixel-volume/releases/\(version)/\(hash)/PixelVolume-\(version)-macOS-Universal.dmg"
        else { throw UpdateFailure.invalidManifest }
        _ = try compareVersions(version, currentVersion)
        return UpdateRelease(version: version, notes: notes, download: url, sha256: hash, size: size.int64Value)
    }

    private var received = Data()
    private var completion: ((Result<UpdateRelease, Error>) -> Void)?
    private var session: URLSession?

    func check(completion: @escaping (Result<UpdateRelease, Error>) -> Void) {
        guard self.completion == nil else { completion(.failure(UpdateFailure.invalidManifest)); return }
        self.completion = completion
        received = Data()
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 20
        config.httpMaximumConnectionsPerHost = 1
        let session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        self.session = session
        session.dataTask(with: Self.endpoint).resume()
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        completionHandler((response as? HTTPURLResponse)?.statusCode == 200 && response.expectedContentLength <= 65536 ? .allow : .cancel)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        if received.count + data.count > 65536 { dataTask.cancel(); return }
        received.append(data)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        let callback = completion
        completion = nil
        self.session = nil
        session.finishTasksAndInvalidate()
        if let error { callback?(.failure(error)) }
        else { callback?(Result { try Self.parse(received) }) }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
