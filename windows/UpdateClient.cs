using System;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace PixelVolume;

internal sealed record UpdateRelease(string Version, string Notes, Uri Download, string Sha256, long Size)
{
    internal bool IsNewer => UpdateClient.CompareVersions(Version, UpdateClient.CurrentVersion) > 0;
}

internal static class UpdateClient
{
    internal const string CurrentVersion = "0.2.6";
    internal const string Endpoint = "https://norgateai.com/pixel-volume/updates/stable.json";
    internal const string KeyId = "pixel-volume-p256-2026-01";
    internal const string PublicKey = "BCStAYN3T5jfuDxNsYIJL9U4RTE5XOG8tpJ1yevbDJL1BkJQi+wUqCoyN/t1yaCNshSqygcUjl7/WNBZvsU9pn8=";
    private static readonly HttpClient Client = new(new HttpClientHandler { AllowAutoRedirect = false })
    { Timeout = TimeSpan.FromSeconds(15), MaxResponseContentBufferSize = 65536 };

    internal static async Task<UpdateRelease> CheckAsync()
    {
        using var response = await Client.GetAsync(Endpoint);
        response.EnsureSuccessStatusCode();
        return Parse(await response.Content.ReadAsByteArrayAsync());
    }

    internal static int CompareVersions(string first, string second)
    {
        static Version ParseVersion(string input) => Regex.IsMatch(input, @"\A(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\z")
            ? Version.Parse(input) : throw new InvalidDataException("版本号无效。");
        return ParseVersion(first).CompareTo(ParseVersion(second));
    }

    internal static UpdateRelease Parse(byte[] envelope, string publicKey = PublicKey)
    {
        if (envelope.Length > 65536) throw new InvalidDataException("更新清单过大。");
        using var outer = JsonDocument.Parse(envelope);
        var root = outer.RootElement;
        if (root.GetProperty("keyId").GetString() != KeyId) throw new InvalidDataException("更新签名密钥不匹配。");
        byte[] payload = Convert.FromBase64String(root.GetProperty("payload").GetString()!);
        byte[] signature = Convert.FromBase64String(root.GetProperty("signature").GetString()!);
        byte[] rawKey = Convert.FromBase64String(publicKey);
        using var verifier = ECDsa.Create(new ECParameters { Curve = ECCurve.NamedCurves.nistP256,
            Q = new ECPoint { X = rawKey[1..33], Y = rawKey[33..65] } });
        if (signature.Length != 64 || !verifier.VerifyData(payload, signature, HashAlgorithmName.SHA256,
                DSASignatureFormat.IeeeP1363FixedFieldConcatenation))
            throw new InvalidDataException("更新清单签名校验失败。");
        using var manifest = JsonDocument.Parse(payload);
        var data = manifest.RootElement;
        if (data.GetProperty("schemaVersion").GetInt32() != 1 || data.GetProperty("channel").GetString() != "stable")
            throw new InvalidDataException("不支持的更新通道。");
        string version = data.GetProperty("version").GetString()!;
        _ = CompareVersions(version, CurrentVersion);
        var platform = data.GetProperty("platforms").GetProperty("windows-x64");
        var url = new Uri(platform.GetProperty("url").GetString()!, UriKind.Absolute);
        string hash = platform.GetProperty("sha256").GetString()!;
        long size = platform.GetProperty("size").GetInt64();
        string notes = data.GetProperty("notes").GetString() ?? "";
        if (notes.Length > 4000) throw new InvalidDataException("更新说明过长。");
        var release = new UpdateRelease(version, notes, url, hash, size);
        ValidateArtifact(release);
        return release;
    }

    internal static void ValidateArtifact(UpdateRelease release)
    {
        var (version, _, url, hash, size) = release;
        _ = CompareVersions(version, CurrentVersion);
        string expected = $"/pixel-volume/releases/{version}/{hash}/PixelVolume-{version}-Windows-x64-Setup.exe";
        if (!Regex.IsMatch(hash, "\\A[a-f0-9]{64}\\z") || size is <= 0 or > 1073741824 ||
            url.Scheme != "https" || url.Host != "norgateai.com" || !url.IsDefaultPort ||
            url.UserInfo != "" || url.Query != "" || url.Fragment != "" || url.AbsolutePath != expected)
            throw new InvalidDataException("更新下载地址无效。");
    }
}
