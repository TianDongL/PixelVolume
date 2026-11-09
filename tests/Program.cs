using System;
using System.IO;
using PixelVolume;

if (args.Length == 1 && args[0] == "--live")
{
    var release = await UpdateClient.CheckAsync();
    Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { current = UpdateClient.CurrentVersion,
        latest = release.Version, updateAvailable = release.IsNewer, signatureVerified = true,
        url = release.Download.AbsoluteUri, sha256 = release.Sha256 }));
    return;
}
string root = args[0];
string key = File.ReadAllText(Path.Combine(root, "public.txt")).Trim();
string expectedVersion = File.ReadAllText(Path.Combine(root, "expected-version.txt")).Trim();
int cases = 0;
foreach (string path in Directory.GetFiles(root, "*.json"))
{
    bool valid = Path.GetFileName(path) == "valid.json";
    bool accepted;
    try { var release = UpdateClient.Parse(File.ReadAllBytes(path), key); accepted = release.IsNewer && release.Version == expectedVersion; }
    catch { accepted = false; }
    if (accepted != valid) throw new Exception("Unexpected result: " + path);
    cases++;
}
foreach (var (a, b, expected) in new[] { ("0.2.4","0.2.4",0),("0.2.10","0.2.9",1),("1.0.0","0.99.99",1),("0.2.3","0.2.4",-1) })
    if (Math.Sign(UpdateClient.CompareVersions(a,b)) != expected) throw new Exception("Version comparison failed");
Console.WriteLine($"Windows protocol: {cases} fixture checks and 4 version comparisons passed");
