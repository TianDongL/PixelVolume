using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace PixelVolume;

internal sealed record SceneEntry(string Id, string Title);
internal sealed record SceneContent(string Kind, string? Html = null);

internal sealed class SceneLibrary
{
    internal static readonly SceneEntry Room = new("room", "像素房间");
    internal static readonly SceneEntry Village = new("village", "雾溪村");
    private const int MaximumBytes = 8 * 1024 * 1024;
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);
    private readonly string directory;
    private string SelectionFile => Path.Combine(directory, "selected");

    internal SceneLibrary(string? directory = null)
    {
        this.directory = directory ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PixelVolume", "Scenes");
    }

    internal IReadOnlyList<SceneEntry> Imported() => Directory.Exists(directory)
        ? Directory.EnumerateFiles(directory, "*.html")
            .Select(path => Entry(Path.GetFileName(path)))
            .OfType<SceneEntry>()
            .OrderBy(scene => scene.Title, StringComparer.CurrentCulture)
            .ToArray()
        : [];

    internal string SelectedId() => File.Exists(SelectionFile) ? File.ReadAllText(SelectionFile) : Room.Id;

    internal SceneContent Load(string id)
    {
        if (id == Room.Id || id == Village.Id) return new SceneContent(id);
        return new SceneContent("html", ReadHtml(ImportedPath(id)));
    }

    internal void Remember(string id) => WriteFile(SelectionFile, id);

    internal SceneEntry Import(string path)
    {
        string html = ReadHtml(path);
        string title = Path.GetFileNameWithoutExtension(path).Trim();
        if (title.Length > 80) title = title[..(char.IsHighSurrogate(title[79]) ? 79 : 80)];
        if (title.Length == 0) title = "导入场景";
        string id = $"{Guid.NewGuid():N}-{title}.html";
        WriteFile(Path.Combine(directory, id), html);
        return new SceneEntry(id, title);
    }

    internal void Remove(string id) => File.Delete(ImportedPath(id));

    private string ImportedPath(string id) => Entry(id) != null
        ? Path.Combine(directory, id)
        : throw new InvalidDataException("找不到这个导入场景。");

    private static SceneEntry? Entry(string id)
    {
        if (id.Length < 39 || id.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || !id.EndsWith(".html", StringComparison.Ordinal)
            || id[32] != '-' || !Guid.TryParseExact(id[..32], "N", out _)) return null;
        return new SceneEntry(id, id[33..^5]);
    }

    private static string ReadHtml(string path)
    {
        using var input = File.OpenRead(path);
        if (input.Length > MaximumBytes) throw new InvalidDataException("场景 HTML 需小于或等于 8 MB。");
        var bytes = new byte[(int)input.Length];
        input.ReadExactly(bytes);
        try
        {
            string html = StrictUtf8.GetString(bytes).TrimStart('\uFEFF');
            if (string.IsNullOrWhiteSpace(html)) throw new InvalidDataException("场景 HTML 为空。");
            return html;
        }
        catch (DecoderFallbackException)
        {
            throw new InvalidDataException("请将场景保存为 UTF-8 编码的 HTML。");
        }
    }

    private void WriteFile(string path, string text)
    {
        Directory.CreateDirectory(directory);
        string temporary = Path.Combine(directory, $"{Guid.NewGuid():N}.tmp");
        try
        {
            File.WriteAllText(temporary, text, Encoding.UTF8);
            File.Move(temporary, path, overwrite: true);
        }
        finally { File.Delete(temporary); }
    }
}
