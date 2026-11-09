using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;

namespace PixelVolume;

// Only artifacts authenticated by UpdateClient are accepted. Never execute a partial download.
internal sealed class UpdateDownload : IDisposable
{
    private readonly HttpClient client;
    internal UpdateDownload(HttpMessageHandler? handler = null)
    {
        client = new HttpClient(handler ?? new HttpClientHandler { AllowAutoRedirect = false })
        { Timeout = Timeout.InfiniteTimeSpan };
        client.DefaultRequestHeaders.UserAgent.ParseAdd($"PixelVolume/{UpdateClient.CurrentVersion}");
    }

    internal async Task<string> DownloadAsync(UpdateRelease release, string cacheRoot,
        IProgress<long>? progress, CancellationToken cancellation)
    {
        UpdateClient.ValidateArtifact(release);
        string directory = Path.Combine(cacheRoot, release.Version + "-" + release.Sha256);
        Directory.CreateDirectory(directory);
        string destination = Path.Combine(directory, Path.GetFileName(release.Download.AbsolutePath));
        if (File.Exists(destination))
        {
            try
            {
                using var verified = await OpenVerifiedAsync(destination, release, cancellation);
                progress?.Report(release.Size);
                return destination;
            }
            catch (InvalidDataException) { File.Delete(destination); }
        }
        string temporary = destination + "." + Guid.NewGuid().ToString("N") + ".partial";
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
        deadline.CancelAfter(TimeSpan.FromMinutes(30));
        var token = deadline.Token;
        try
        {
            using var response = await client.GetAsync(release.Download, HttpCompletionOption.ResponseHeadersRead, token);
            if (response.StatusCode != HttpStatusCode.OK ||
                response.RequestMessage?.RequestUri != release.Download)
                throw new InvalidDataException("更新下载地址没有返回安装包，请稍后重试。");
            if (response.Content.Headers.ContentLength is long length && length != release.Size)
                throw new InvalidDataException("安装包大小与更新清单不一致。");
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            await using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write,
                FileShare.None, 131072, FileOptions.Asynchronous | FileOptions.SequentialScan))
            await using (var input = await response.Content.ReadAsStreamAsync(token))
            {
                var buffer = new byte[131072];
                long received = 0;
                long reportedAt = 0;
                int count;
                while ((count = await input.ReadAsync(buffer, token)) != 0)
                {
                    received += count;
                    if (received > release.Size) throw new InvalidDataException("安装包超过更新清单声明的大小。");
                    hash.AppendData(buffer, 0, count);
                    await output.WriteAsync(buffer.AsMemory(0, count), token);
                    if (Environment.TickCount64 - reportedAt >= 100 || received == release.Size)
                    {
                        progress?.Report(received);
                        reportedAt = Environment.TickCount64;
                    }
                }
                if (received != release.Size || !Matches(hash.GetHashAndReset(), release.Sha256))
                    throw new InvalidDataException("安装包校验失败，文件可能下载不完整。请重新下载。");
                await output.FlushAsync(token);
            }
            token.ThrowIfCancellationRequested();
            File.Move(temporary, destination, true);
            return destination;
        }
        finally
        {
            try { File.Delete(temporary); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
    }

    // Keep this handle open through Process.Start: other processes cannot rewrite/replace the executable.
    internal static async Task<FileStream> OpenVerifiedAsync(string path, UpdateRelease release, CancellationToken token)
    {
        UpdateClient.ValidateArtifact(release);
        var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read,
            131072, FileOptions.Asynchronous | FileOptions.SequentialScan);
        try
        {
            if (file.Length != release.Size || !Matches(await SHA256.HashDataAsync(file, token), release.Sha256))
                throw new InvalidDataException("安装包校验失败，请重新下载。");
            file.Position = 0;
            return file;
        }
        catch { file.Dispose(); throw; }
    }

    private static bool Matches(byte[] actual, string expected)
        => CryptographicOperations.FixedTimeEquals(actual, Convert.FromHexString(expected));

    public void Dispose() => client.Dispose();
}
