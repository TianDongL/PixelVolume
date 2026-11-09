"""Verify a signed release and optionally stream-download both installer hashes."""
import argparse
import base64
import hashlib
import json
import re
import urllib.request
from pathlib import Path
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, utils


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Unexpected update/download redirect")


def verify(args):
    config = json.loads((Path(__file__).resolve().parents[1] / "update-channel.json").read_text())
    opener = urllib.request.build_opener(NoRedirect())
    if args.manifest_file:
        raw = args.manifest_file.read_bytes()
    else:
        with opener.open(config["endpoint"], timeout=30) as response:
            raw = response.read(65537)
    if len(raw) > 65536:
        raise ValueError("Manifest exceeds the client size limit")
    envelope = json.loads(raw)
    if envelope["keyId"] != config["keyId"]:
        raise ValueError("Unknown signing key")
    signature = base64.b64decode(envelope["signature"], validate=True)
    payload = base64.b64decode(envelope["payload"], validate=True)
    if len(signature) != 64:
        raise ValueError("Invalid signature size")
    key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), base64.b64decode(config["publicKey"]))
    der = utils.encode_dss_signature(int.from_bytes(signature[:32], "big"), int.from_bytes(signature[32:], "big"))
    key.verify(der, payload, ec.ECDSA(hashes.SHA256()))
    release = json.loads(payload)
    version = release["version"]
    if release["schemaVersion"] != 1 or release["channel"] != "stable" or not re.fullmatch(r"(0|[1-9][0-9]{0,5})(\.(0|[1-9][0-9]{0,5})){2}", version):
        raise ValueError("Invalid release version or schema")
    if set(release["platforms"]) != {"windows-x64", "macos-universal"}:
        raise ValueError("A stable release must contain both platforms")
    checked = []
    for platform, suffix in (("windows-x64", "Windows-x64-Setup.exe"), ("macos-universal", "macOS-Universal.dmg")):
        asset = release["platforms"][platform]
        digest = asset["sha256"]
        if not re.fullmatch(r"[a-f0-9]{64}", digest) or not 0 < asset["size"] <= 1073741824:
            raise ValueError("Invalid artifact metadata")
        expected = f"https://norgateai.com/pixel-volume/releases/{version}/{digest}/PixelVolume-{version}-{suffix}"
        if asset["url"] != expected:
            raise ValueError("Unexpected download URL")
        cdn_expected = f"https://dl.norgateai.com/download/releases/pixel-volume/{version}/{digest}/PixelVolume-{version}-{suffix}"
        if "cdnUrl" in asset and asset["cdnUrl"] != cdn_expected:
            raise ValueError("Unexpected CDN URL")
        download_url = asset.get("cdnUrl", expected)
        if args.download:
            h = hashlib.sha256()
            size = 0
            with opener.open(download_url, timeout=30) as response:
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > asset["size"]:
                        raise ValueError("Download is larger than the signed size")
                    h.update(chunk)
            if size != asset["size"] or h.hexdigest() != digest:
                raise ValueError("Public artifact hash/size mismatch: " + platform)
        checked.append({"platform": platform, "url": download_url, "size": asset["size"], "sha256": digest, "downloadVerified": args.download})
    print(json.dumps({"version": version, "signatureVerified": True, "platforms": checked}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest-file", type=Path)
    parser.add_argument("--download", action="store_true")
    verify(parser.parse_args())
