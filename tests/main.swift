import Foundation

let folder = URL(fileURLWithPath: CommandLine.arguments[1])
let key = try String(contentsOf: folder.appendingPathComponent("public.txt"), encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
var count = 0
for file in try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil) where file.pathExtension == "json" {
    let expected = file.lastPathComponent == "valid.json"
    let result = try? UpdateClient.parse(Data(contentsOf: file), publicKey: key)
    let accepted = result?.version == "0.2.5" && result?.isNewer == true
    precondition(expected == accepted, "Unexpected result: \(file.lastPathComponent)")
    count += 1
}
for (a,b,wanted) in [("0.2.4","0.2.4",0),("0.2.10","0.2.9",1),("1.0.0","0.99.99",1),("0.2.3","0.2.4",-1)] {
    let result = try UpdateClient.compareVersions(a,b)
    precondition(result == wanted)
}
print("Mac protocol: \(count) fixture checks and 4 version comparisons passed")
