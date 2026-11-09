using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using PixelVolume;

internal static class DownloadTests
{
    internal static async Task Run()
    {
        // No product files, registry entries, GUI or installation are used by these tests.
        string root = Path.Combine(Path.GetTempPath(), "PixelVolume-DownloadTests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        byte[] data = RandomNumberGenerator.GetBytes(524291);
        string hash = Convert.ToHexStringLower(SHA256.HashData(data));
        var release = new UpdateRelease("9.9.9", "Fixture", new Uri($"https://norgateai.com/pixel-volume/releases/9.9.9/{hash}/PixelVolume-9.9.9-Windows-x64-Setup.exe"), hash, data.Length);
        int count = 0;
        try
        {
            using (var download = new UpdateDownload(new Reply(data)))
            {
                string file = await download.DownloadAsync(release, Path.Combine(root, "valid"), null, CancellationToken.None);
                using (var verified = await UpdateDownload.OpenVerifiedAsync(file, release, CancellationToken.None))
                {
                    if (verified.Length != data.Length) throw new Exception("Valid size");
                    if (OperatingSystem.IsWindows())
                    {
                        try { using var writer = File.OpenWrite(file); throw new Exception("Verified file was writable"); }
                        catch (IOException) { }
                    }
                }
                count++;
                // A correct cache must work even when the network is unavailable.
                using var offline = new UpdateDownload(new Reply(Array.Empty<byte>(), HttpStatusCode.ServiceUnavailable));
                if (await offline.DownloadAsync(release, Path.Combine(root, "valid"), null, CancellationToken.None) != file)
                    throw new Exception("Cache reuse");
                count++;
                await File.WriteAllTextAsync(file, "tampered cached installer");
                await download.DownloadAsync(release, Path.Combine(root, "valid"), null, CancellationToken.None);
                using var repaired = await UpdateDownload.OpenVerifiedAsync(file, release, CancellationToken.None);
                count++;
            }
            byte[] corrupt = (byte[])data.Clone(); corrupt[100] ^= 1;
            foreach (var (name, response) in new[] {
                ("hash", new Reply(corrupt)), ("short", new Reply(data[..100], unknownLength:true)),
                ("long", new Reply(new byte[data.Length+1], unknownLength:true)),
                ("length", new Reply(data[..100])), ("redirect", new Reply(data, HttpStatusCode.Redirect)),
                ("notfound", new Reply(data, HttpStatusCode.NotFound)),
                ("destination", new Reply(data, differentDestination:true)) })
            {
                using var download = new UpdateDownload(response);
                string cache = Path.Combine(root, name);
                try { await download.DownloadAsync(release, cache, null, CancellationToken.None); throw new Exception("Accepted " + name); }
                catch (InvalidDataException) { }
                if (Directory.GetFiles(cache, "*", SearchOption.AllDirectories).Length != 0) throw new Exception("Left partial " + name);
                count++;
            }
            using (var canceled = new CancellationTokenSource())
            {
                using var download = new UpdateDownload(new Reply(data, cancel:canceled));
                string cache = Path.Combine(root, "cancel");
                try { await download.DownloadAsync(release, cache, null, canceled.Token); throw new Exception("Ignored cancel"); }
                catch (OperationCanceledException) { }
                if (Directory.GetFiles(cache, "*", SearchOption.AllDirectories).Length != 0) throw new Exception("Left canceled data");
                count++;
            }
            Console.WriteLine($"Windows download: {count} integrity, cache, redirect and cancellation cases passed");
        }
        finally
        {
            // A newly generated, private test directory; never remove the product cache.
            Directory.Delete(root, true);
        }
    }

    private sealed class Reply(byte[] data, HttpStatusCode status = HttpStatusCode.OK,
        bool unknownLength = false, bool differentDestination = false, CancellationTokenSource? cancel = null) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            cancel?.Cancel();
            token.ThrowIfCancellationRequested();
            var content = new Bytes(data, !unknownLength);
            return Task.FromResult(new HttpResponseMessage(status) { Content = content,
                RequestMessage = differentDestination ? new HttpRequestMessage(HttpMethod.Get, "https://example.com/wrong") : request });
        }
    }
    private sealed class Bytes(byte[] data, bool lengthKnown) : HttpContent
    {
        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => stream.WriteAsync(data).AsTask();
        protected override bool TryComputeLength(out long length) { length = data.Length; return lengthKnown; }
    }
}
