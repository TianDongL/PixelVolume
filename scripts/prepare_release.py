"""Prepare an immutable dual-platform release and its signed stable pointer.

Private signing keys must be stored outside this repository and off the server.
Requires cryptography. Upload and verify artifacts BEFORE activating stable.json.
"""
import argparse
import base64
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils


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
    print(json.dumps({"version": args.version, "platforms": platforms}, indent=2))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--version", required=True)
    p.add_argument("--windows", type=Path, required=True)
    p.add_argument("--macos", type=Path, required=True)
    p.add_argument("--key", type=Path, required=True)
    p.add_argument("--notes", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    prepare(p.parse_args())
