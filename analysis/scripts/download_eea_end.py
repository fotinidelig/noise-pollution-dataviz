#!/usr/bin/env python3
"""Download EEA END 2022 exposure Excel + contour GeoPackages via Nextcloud public WebDAV.

Uses share token auth against sdi.eea.europa.eu datashare. Supports resume (HTTP Range).
"""

from __future__ import annotations

import argparse
import base64
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path

SHARE_TOKEN = "sptXqwkQr5g7Bp5"
WEBDAV_ROOT = "https://sdi.eea.europa.eu/datashare/public.php/webdav"
EXPOSURE_DIR = "eea_t_noise-exposure-2022_p_2021_v02_r00"
CONTOURS_DIR = "eea_v_3035_1_k_noise-contours-end2022_p_2026_v01_r00"
HUB_URL = (
    "https://www.eea.europa.eu/en/datahub/datahubitem-view/"
    "c952f520-8d71-42c9-b74c-b7eb002f939b"
)


@dataclass
class RemoteFile:
    name: str
    href: str
    size: int | None
    is_dir: bool


def _auth_header() -> str:
    token = base64.b64encode(f"{SHARE_TOKEN}:".encode()).decode()
    return f"Basic {token}"


def propfind(remote_path: str, depth: int = 1) -> list[RemoteFile]:
    url = f"{WEBDAV_ROOT}/{remote_path.lstrip('/')}"
    body = (
        b'<?xml version="1.0"?>'
        b'<d:propfind xmlns:d="DAV:">'
        b"<d:prop><d:displayname/><d:getcontentlength/>"
        b"<d:resourcetype/></d:prop></d:propfind>"
    )
    req = urllib.request.Request(
        url,
        data=body,
        method="PROPFIND",
        headers={
            "Authorization": _auth_header(),
            "Depth": str(depth),
            "Content-Type": "text/xml",
            "User-Agent": "noise-pollution-dataviz/0.1",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        xml = resp.read().decode("utf-8", "replace")

    files: list[RemoteFile] = []
    for block in re.findall(r"<d:response>(.*?)</d:response>", xml, flags=re.S):
        href = html.unescape(re.search(r"<d:href>(.*?)</d:href>", block).group(1))
        name_m = re.search(r"<d:displayname>(.*?)</d:displayname>", block)
        name = html.unescape(name_m.group(1)) if name_m else Path(href).name
        size_m = re.search(r"<d:getcontentlength>(\d+)</d:getcontentlength>", block)
        size = int(size_m.group(1)) if size_m else None
        is_dir = "<d:collection" in block
        files.append(RemoteFile(name=name, href=href, size=size, is_dir=is_dir))
    return files


def download_file(remote_name: str, remote_dir: str, dest: Path, expected_size: int | None) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{WEBDAV_ROOT}/{remote_dir.rstrip('/')}/{remote_name}"
    existing = dest.stat().st_size if dest.exists() else 0
    if expected_size is not None and existing == expected_size and expected_size > 0:
        return {
            "name": remote_name,
            "url": url,
            "path": str(dest),
            "bytes": existing,
            "status": "already_complete",
        }

    headers = {
        "Authorization": _auth_header(),
        "User-Agent": "noise-pollution-dataviz/0.1",
    }
    mode = "wb"
    if existing > 0 and (expected_size is None or existing < expected_size):
        headers["Range"] = f"bytes={existing}-"
        mode = "ab"

    attempt = 0
    while True:
        attempt += 1
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=300) as resp:
                # If server ignores Range and returns 200, restart file.
                if mode == "ab" and getattr(resp, "status", 200) == 200:
                    mode = "wb"
                    existing = 0
                chunk = 1024 * 1024
                written = existing if mode == "ab" else 0
                t0 = time.time()
                with dest.open(mode) as out:
                    while True:
                        buf = resp.read(chunk)
                        if not buf:
                            break
                        out.write(buf)
                        written += len(buf)
                        if written and written % (50 * 1024 * 1024) < chunk:
                            elapsed = max(time.time() - t0, 1e-6)
                            mb = written / 1e6
                            rate = (written - existing) / 1e6 / elapsed
                            print(
                                f"  … {remote_name}: {mb:.1f} MB ({rate:.1f} MB/s)",
                                flush=True,
                            )
            final = dest.stat().st_size
            status = "complete"
            if expected_size is not None and final != expected_size:
                status = "size_mismatch"
            return {
                "name": remote_name,
                "url": url,
                "path": str(dest),
                "bytes": final,
                "expected_bytes": expected_size,
                "status": status,
                "attempts": attempt,
            }
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            if attempt >= 8:
                return {
                    "name": remote_name,
                    "url": url,
                    "path": str(dest),
                    "bytes": dest.stat().st_size if dest.exists() else 0,
                    "expected_bytes": expected_size,
                    "status": f"failed: {exc}",
                    "attempts": attempt,
                }
            wait = min(2**attempt, 60)
            print(f"  retry {attempt} for {remote_name} after {exc!r}; sleep {wait}s", flush=True)
            time.sleep(wait)
            existing = dest.stat().st_size if dest.exists() else 0
            headers = {
                "Authorization": _auth_header(),
                "User-Agent": "noise-pollution-dataviz/0.1",
            }
            mode = "wb"
            if existing > 0:
                headers["Range"] = f"bytes={existing}-"
                mode = "ab"


def human_bytes(n: int | None) -> str:
    if n is None:
        return "?"
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024
    return str(n)


def write_raw_readme(root: Path, exposure_files: list[dict], contour_files: list[dict]) -> None:
    lines = [
        "# EEA END raw downloads",
        "",
        f"Hub: {HUB_URL}",
        "",
        "Downloaded via Nextcloud public WebDAV (`sdi.eea.europa.eu/datashare`) "
        f"share token `{SHARE_TOKEN}` (public datastore).",
        "",
        "## Exposure (tabular)",
        "",
        f"- Remote folder: `{EXPOSURE_DIR}`",
        f"- Local folder: `{root / 'exposure'}`",
        "",
        "| File | Bytes | URL | Status |",
        "| --- | ---: | --- | --- |",
    ]
    for f in exposure_files:
        lines.append(
            f"| `{f['name']}` | {f.get('bytes', '')} | {f.get('url', '')} | {f.get('status', '')} |"
        )
    lines += [
        "",
        "## Contours (vector GeoPackage / 7z)",
        "",
        f"- Remote folder: `{CONTOURS_DIR}`",
        f"- Local folder: `{root / 'contours'}`",
        "- CRS expected: EPSG:3035 (EEA LAEA) — confirm per layer in analysis.",
        "- Full Europe download is multi‑tens of GB; files are gitignored.",
        "",
        "| File | Bytes | URL | Status |",
        "| --- | ---: | --- | --- |",
    ]
    for f in contour_files:
        lines.append(
            f"| `{f['name']}` | {f.get('bytes', '')} | {f.get('url', '')} | {f.get('status', '')} |"
        )
    lines += [
        "",
        "## Notes",
        "",
        "- Use `analysis/scripts/download_eea_end.py` to resume incomplete transfers.",
        "- Contour packages for some EEA countries may be absent from this release folder;",
        "  the file list above is authoritative for what EEA published in this datastore path.",
        "",
    ]
    (root / "README.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--raw-root",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "data" / "raw" / "eea-end",
    )
    parser.add_argument(
        "--only",
        choices=("all", "exposure", "contours"),
        default="all",
    )
    parser.add_argument(
        "--contours-max-mb",
        type=float,
        default=None,
        help="Only download contour files at or below this size (MB). Useful for staged runs.",
    )
    parser.add_argument(
        "--contours-include",
        default=None,
        help="Comma-separated basename prefixes to download (e.g. EE,LV,DK).",
    )
    args = parser.parse_args()
    raw_root: Path = args.raw_root
    exp_out = raw_root / "exposure"
    cont_out = raw_root / "contours"
    exp_out.mkdir(parents=True, exist_ok=True)
    cont_out.mkdir(parents=True, exist_ok=True)

    manifest: dict = {
        "hub": HUB_URL,
        "share_token": SHARE_TOKEN,
        "exposure_remote": EXPOSURE_DIR,
        "contours_remote": CONTOURS_DIR,
        "exposure": [],
        "contours": [],
    }

    if args.only in ("all", "exposure"):
        print("Listing exposure…", flush=True)
        remote = [f for f in propfind(f"{EXPOSURE_DIR}/") if not f.is_dir]
        for f in remote:
            # Prefer the Nov 2024 / v4 summary workbook + README/metadata
            print(f"Downloading exposure {f.name} ({human_bytes(f.size)})", flush=True)
            result = download_file(f.name, EXPOSURE_DIR, exp_out / f.name, f.size)
            print(f"  → {result['status']} {human_bytes(result['bytes'])}", flush=True)
            manifest["exposure"].append(result)

    if args.only in ("all", "contours"):
        print("Listing contours…", flush=True)
        remote = [f for f in propfind(f"{CONTOURS_DIR}/") if not f.is_dir]
        include = None
        if args.contours_include:
            include = {p.strip().upper() for p in args.contours_include.split(",") if p.strip()}
        for f in sorted(remote, key=lambda x: (x.size or 0)):
            if include is not None:
                stem = Path(f.name).stem.upper().split("-")[0]
                if stem not in include and f.name.upper() not in include:
                    # also allow README/metadata
                    if not f.name.lower().endswith((".md", ".xml", ".jpg", ".png")):
                        continue
            if args.contours_max_mb is not None and f.size is not None:
                if f.size > args.contours_max_mb * 1_000_000 and f.name.lower().endswith(
                    (".gpkg", ".7z", ".zip")
                ):
                    print(
                        f"Skipping {f.name} ({human_bytes(f.size)}) > max {args.contours_max_mb} MB",
                        flush=True,
                    )
                    manifest["contours"].append(
                        {
                            "name": f.name,
                            "url": f"{WEBDAV_ROOT}/{CONTOURS_DIR}/{f.name}",
                            "bytes": f.size,
                            "status": "skipped_max_mb",
                        }
                    )
                    continue
            print(f"Downloading contour {f.name} ({human_bytes(f.size)})", flush=True)
            result = download_file(f.name, CONTOURS_DIR, cont_out / f.name, f.size)
            print(f"  → {result['status']} {human_bytes(result['bytes'])}", flush=True)
            manifest["contours"].append(result)

    write_raw_readme(raw_root, manifest["exposure"], manifest["contours"])
    (raw_root / "download_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print("Wrote README + download_manifest.json", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
