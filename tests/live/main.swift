import Foundation

// This console-only probe shares the shipping update client, with no AppKit,
// volume controls, login registration, permission requests or desktop windows.
let client = UpdateClient()
var finished = false
var status: Int32 = 2
client.check { result in
    DispatchQueue.main.async {
        switch result {
        case .success(let release):
            let value: [String: Any] = ["current": UpdateClient.currentVersion, "latest": release.version,
                "updateAvailable": release.isNewer, "signatureVerified": true,
                "url": release.download.absoluteString, "sha256": release.sha256]
            if let data = try? JSONSerialization.data(withJSONObject: value, options: .sortedKeys) {
                print(String(data: data, encoding: .utf8)!)
                status = 0
            }
        case .failure(let error): print("Update probe failed: \(error)")
        }
        finished = true
    }
}
while !finished { RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.1)) }
exit(status)
