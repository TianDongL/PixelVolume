"""Prepare an immutable dual-platform release and its signed stable pointer.

Private signing keys must be stored outside this repository and off the server.
Requires cryptography. Upload and verify artifacts BEFORE activating stable.json.
"""
import argparse
import base64
import hashlib
import json
import html
import plistlib
import re
import shutil
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils, ed25519


def prepare(args):
    root = Path(__file__).resolve().parents[1]
    config = json.loads((root / "update-channel.json").read_text(encoding="utf-8"))
    if not re.fullmatch(r"(0|[1-9][0-9]{0,5})(\.(0|[1-9][0-9]{0,5})){2}", args.version):
        raise ValueError("Expected a three-part release version")
    key_path = args.key.resolve()
    if key_path.is_relative_to(root):
        raise ValueError("Keep the private signing key outside the repository")
    key = serialization.load_pem_private_key(key_path.read_bytes(), password=None)
    if not isinstance(key, ec.EllipticCurvePrivateKey) or not isinstance(key.curve, ec.SECP256R1):
        raise ValueError("Expected a P-256 private key")
    public = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    if base64.b64encode(public).decode() != config["publicKey"]:
        raise ValueError("The key does not match the embedded update public key")
    notes = args.notes.read_text(encoding="utf-8").strip()
    if len(notes) > 4000:
        raise ValueError("Release notes exceed the client limit")
    mac_info = plistlib.loads((root / "macos/Info.plist").read_bytes())
    if mac_info["CFBundleShortVersionString"] != args.version:
        raise ValueError("Mac source version does not match the release")
    signature_text = args.macos_signature.read_text(encoding="utf-8").strip()
    ed_signature = base64.b64decode(signature_text, validate=True)
    ed_key = ed25519.Ed25519PublicKey.from_public_bytes(base64.b64decode(config["macos"]["publicKey"]))
    ed_key.verify(ed_signature, args.macos.read_bytes())
    platform_files = {
        "windows-x64": (args.windows, f"PixelVolume-{args.version}-Windows-x64-Setup.exe"),
        "macos-universal": (args.macos, f"PixelVolume-{args.version}-macOS-Universal.dmg"),
    }
    # Validate both files before writing anything; never produce a one-platform pointer.
    artifacts = []
    for platform, (path, filename) in platform_files.items():
        size = path.stat().st_size
        if not 0 < size <= 1073741824:
            raise ValueError(f"Invalid artifact size: {platform}")
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        artifacts.append((platform, path, filename, digest, size))
    args.out.mkdir(parents=True, exist_ok=True)
    platforms = {}
    for platform, path, filename, digest, size in artifacts:
        relative = Path("releases") / args.version / digest / filename
        dest = args.out / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists() and hashlib.sha256(dest.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Refusing to overwrite immutable artifact: {dest}")
        shutil.copyfile(path, dest)
        platforms[platform] = {"url": "https://norgateai.com/pixel-volume/" + relative.as_posix(), "sha256": digest, "size": size}
    manifest = {"schemaVersion": 1, "channel": "stable", "version": args.version,
                "publishedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "notes": notes, "platforms": platforms}
    payload = json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    der = key.sign(payload, ec.ECDSA(hashes.SHA256()))
    r, s = utils.decode_dss_signature(der)
    signature = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    envelope = {"keyId": config["keyId"], "payload": base64.b64encode(payload).decode(), "signature": base64.b64encode(signature).decode()}
    (args.out / "updates").mkdir(exist_ok=True)
    (args.out / "updates" / "stable.json").write_text(json.dumps(envelope, indent=2) + "\n", encoding="utf-8")
    (args.out / "release.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Sign this XML on the Mac with sign-macos-feed.sh before publishing it.
    ns = "http://www.andymatuschak.org/xml-namespaces/sparkle"
    ET.register_namespace("sparkle", ns)
    rss = ET.Element("rss", {"version": "2.0"})
    channel = ET.SubElement(rss, "channel")
    ET.SubElement(channel, "title").text = "像素音量更新"
    ET.SubElement(channel, "link").text = "https://norgateai.com/pixel-volume/"
    ET.SubElement(channel, "language").text = "zh-CN"
    item = ET.SubElement(channel, "item")
    ET.SubElement(item, "title").text = "像素音量 " + args.version
    ET.SubElement(item, "pubDate").text = format_datetime(datetime.now(timezone.utc))
    ET.SubElement(item, "description").text = "".join("<p>" + html.escape(line) + "</p>" for line in notes.splitlines() if line)
    ET.SubElement(item, "{" + ns + "}version").text = mac_info["CFBundleVersion"]
    ET.SubElement(item, "{" + ns + "}shortVersionString").text = args.version
    ET.SubElement(item, "{" + ns + "}minimumSystemVersion").text = mac_info["LSMinimumSystemVersion"]
    mac = platforms["macos-universal"]
    ET.SubElement(item, "enclosure", {"url": mac["url"], "length": str(mac["size"]),
        "type": "application/octet-stream", "{" + ns + "}edSignature": signature_text})
    ET.ElementTree(rss).write(args.out / "updates/appcast.xml", encoding="utf-8", xml_declaration=True)
    print(json.dumps({"version": args.version, "platforms": platforms}, indent=2))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--version", required=True)
    p.add_argument("--windows", type=Path, required=True)
    p.add_argument("--macos", type=Path, required=True)
    p.add_argument("--macos-signature", type=Path, required=True)
    p.add_argument("--key", type=Path, required=True)
    p.add_argument("--notes", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    prepare(p.parse_args())
