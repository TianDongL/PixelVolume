"""Fresh ephemeral test key; fixtures never use the production signing key."""
import base64
import copy
import json
import re
from pathlib import Path
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils

root = Path(__file__).parent / "fixtures"
root.mkdir(exist_ok=True)
key = ec.generate_private_key(ec.SECP256R1())
public = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
(root / "public.txt").write_text(base64.b64encode(public).decode())
repo = Path(__file__).resolve().parents[1]
windows_version = re.search(r'CurrentVersion = "([0-9.]+)"', (repo / "windows/UpdateClient.cs").read_text(encoding="utf-8")).group(1)
mac_version = re.search(r'currentVersion = "([0-9.]+)"', (repo / "macos/UpdateClient.swift").read_text(encoding="utf-8")).group(1)
assert windows_version == mac_version, "Both platforms must use the same release version"
parts = [int(part) for part in windows_version.split('.')]
parts[2] += 1
version = '.'.join(map(str, parts))
(root / "expected-version.txt").write_text(version)
body = {"schemaVersion": 1, "channel": "stable", "version": version, "notes": "测试更新", "platforms": {}}
for platform, suffix in (("windows-x64", "Windows-x64-Setup.exe"), ("macos-universal", "macOS-Universal.dmg")):
    body["platforms"][platform] = {"url": f"https://norgateai.com/pixel-volume/releases/{version}/{'a'*64}/PixelVolume-{version}-{suffix}", "sha256": "a"*64, "size": 1234}

def write(name, obj, tamper=False, key_id="pixel-volume-p256-2026-01"):
    payload = json.dumps(obj, ensure_ascii=False).encode()
    r, s = utils.decode_dss_signature(key.sign(payload, ec.ECDSA(hashes.SHA256())))
    if tamper:
        payload += b" "
    envelope = {"keyId": key_id, "payload": base64.b64encode(payload).decode(), "signature": base64.b64encode(r.to_bytes(32,"big")+s.to_bytes(32,"big")).decode()}
    (root / (name + ".json")).write_text(json.dumps(envelope), encoding="utf-8")

write("valid", body)
cdn_body = copy.deepcopy(body)
for platform in cdn_body["platforms"].values():
    platform["cdnUrl"] = platform["url"].replace("https://norgateai.com/pixel-volume/releases/", "https://dl.norgateai.com/download/releases/pixel-volume/")
write("valid-cdn", cdn_body)
for name, transform in {
    "cdn-http": lambda u: u.replace("https:", "http:"),
    "cdn-host": lambda u: u.replace("dl.norgateai.com", "example.com"),
    "cdn-query": lambda u: u + "?redirect=bad",
    "cdn-prefix": lambda u: u.replace("/pixel-volume/", "/other-product/"),
    "cdn-port": lambda u: u.replace("dl.norgateai.com", "dl.norgateai.com:444"),
    "cdn-hash": lambda u: u.replace("a" * 64, "b" * 64),
}.items():
    changed = copy.deepcopy(cdn_body)
    for platform in changed["platforms"].values(): platform["cdnUrl"] = transform(platform["cdnUrl"])
    write(name, changed)
write("tampered", body, tamper=True)
write("wrong-key", body, key_id="unknown")
for name, change in {
    "http": lambda b: [p.update(url=p["url"].replace("https:","http:")) for p in b["platforms"].values()],
    "foreign-host": lambda b: [p.update(url=p["url"].replace("norgateai.com","example.com")) for p in b["platforms"].values()],
    "query": lambda b: [p.update(url=p["url"]+"?redirect=x") for p in b["platforms"].values()],
    "hash": lambda b: [p.update(sha256="invalid") for p in b["platforms"].values()],
    "size": lambda b: [p.update(size=0) for p in b["platforms"].values()],
    "version": lambda b: b.update(version=version+"-beta"),
    "channel": lambda b: b.update(channel="beta"),
    "schema": lambda b: b.update(schemaVersion=2),
    "missing-platform": lambda b: b.update(platforms={}),
}.items():
    changed = copy.deepcopy(body)
    change(changed)
    write(name, changed)
(root / "oversized.json").write_bytes(b" " * 65537)
print("Generated 20 signed/invalid protocol cases with an ephemeral test key")
