#!/usr/bin/env python3
"""Build end_*.pmtiles from existing per-country GeoJSON under data/processed/map/geojson/.

Use after preprocess has written country files (or mid-wave salvage).
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "data" / "processed" / "map"
PUBLIC_DIR = REPO / "app" / "public" / "data"
GEO_ROOT = OUT_DIR / "geojson"

KEYS = [
    ("road", "Lden"),
    ("road", "Lnight"),
    ("rail", "Lden"),
    ("rail", "Lnight"),
    ("aircraft", "Lden"),
    ("aircraft", "Lnight"),
    ("industry", "Lden"),
    ("industry", "Lnight"),
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    parser.add_argument("--public-dir", type=Path, default=PUBLIC_DIR)
    parser.add_argument("--geo-root", type=Path, default=GEO_ROOT)
    args = parser.parse_args()

    if not shutil.which("tippecanoe"):
        raise SystemExit("tippecanoe not found on PATH")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    args.public_dir.mkdir(parents=True, exist_ok=True)

    manifest = {"outputs": {}, "countries": sorted(p.name for p in args.geo_root.iterdir() if p.is_dir())}

    for viz_source, metric in KEYS:
        pattern = f"*_{viz_source}_{metric}.geojson"
        inputs = sorted(args.geo_root.glob(f"*/{pattern}"))
        if not inputs:
            print(f"skip {viz_source}/{metric}: no geojson")
            continue
        out_name = f"end_{viz_source}_{metric.lower()}.pmtiles"
        out_path = args.out_dir / out_name
        if out_path.exists():
            out_path.unlink()
        cmd = [
            "tippecanoe",
            "-o",
            str(out_path),
            "-l",
            "contours",
            "-zg",
            "--drop-densest-as-needed",
            "--extend-zooms-if-still-dropping",
            "--simplification=10",
            "--simplify-only-low-zooms",
            "--force",
            "--read-parallel",
            *[str(p) for p in inputs],
        ]
        print(f"building {out_name} from {len(inputs)} files", flush=True)
        subprocess.check_call(cmd)
        dest = args.public_dir / out_name
        shutil.copy2(out_path, dest)
        manifest["outputs"][f"{viz_source}__{metric}"] = {
            "pmtiles": str(out_path.relative_to(REPO)),
            "public": str(dest.relative_to(REPO)),
            "bytes": out_path.stat().st_size,
            "countries": len(inputs),
        }
        print(f"  → {dest} ({out_path.stat().st_size / 1e6:.1f} MB)", flush=True)

    (args.out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    (args.public_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print("Done.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
