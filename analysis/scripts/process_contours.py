#!/usr/bin/env python3
"""Aggregate EEA END contour GeoPackages to area tables (no PMTiles / web assets).

For each completed country package, compute area_m2 by:
  country × source × metric (Lden/Lnight) × category (dB class) × layer scope

Uses pyogrio/geopandas; processes layers in batches to limit memory.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

import pandas as pd
import pyogrio

REPO = Path(__file__).resolve().parents[2]
CONT_DIR = REPO / "data" / "raw" / "eea-end" / "contours"
OUT_DIR = REPO / "data" / "processed" / "eea-end"
MANIFEST = OUT_DIR / "contour_area_manifest.json"

LAYER_RE = re.compile(
    r"^NoiseContours_(?P<source>.+)_(?P<metric>Lden|Lnight)$"
)


# Published sizes from EEA datastore listing (Mar 2026 contour folder).
PUBLISHED_SIZES = {
    "AT.gpkg": 2940518400,
    "BE.gpkg": 3880706048,
    "CH.gpkg": 1121607680,
    "CY.gpkg": 219697152,
    "CZ.gpkg": 609054720,
    "DE-gpkg.7z": 9308491833,
    "DK.gpkg": 255508480,
    "EE.gpkg": 73924608,
    "ES.gpkg": 1644613632,
    "FI.gpkg": 331370496,
    "FR.gpkg": 7611727872,
    "HR.gpkg": 1402716160,
    "IE.gpkg": 2158432256,
    "IT.gpkg": 12571758592,
    "LT.gpkg": 210378752,
    "LU.gpkg": 1128792064,
    "LV.gpkg": 63721472,
    "MT.gpkg": 183537664,
    "NL.gpkg": 1055731712,
    "NO.gpkg": 575995904,
    "PL.gpkg": 9299005440,
    "PT.gpkg": 167600128,
    "RO.gpkg": 216272896,
    "SE.gpkg": 7117332480,
}


def expected_size_map() -> dict[str, int]:
    """Prefer live download manifest sizes; fall back to published listing."""
    out = dict(PUBLISHED_SIZES)
    path = REPO / "data" / "raw" / "eea-end" / "download_manifest.json"
    if path.exists():
        data = json.loads(path.read_text())
        for item in data.get("contours", []):
            name = item.get("name")
            exp = item.get("expected_bytes") or item.get("bytes")
            if name and exp and item.get("status") in {
                "complete",
                "already_complete",
                "size_mismatch",
                "skipped_max_mb",
            }:
                out[name] = int(exp)
            elif name and item.get("expected_bytes"):
                out[name] = int(item["expected_bytes"])
    return out


def is_complete(path: Path, expected: dict[str, int]) -> bool:
    if not path.exists() or path.stat().st_size < 1_000_000:
        return False
    exp = expected.get(path.name)
    if exp is not None:
        return path.stat().st_size == exp
    # Unknown file: only accept if pyogrio can open it
    try:
        pyogrio.list_layers(path)
        return True
    except Exception:
        return False


def parse_layer_name(layer: str) -> tuple[str, str] | None:
    m = LAYER_RE.match(layer)
    if not m:
        return None
    return m.group("source"), m.group("metric")


def urban_flag(source: str) -> str:
    if "InAgglomeration" in source and not source.startswith("major"):
        return "in_agglomeration"
    if source.startswith("major"):
        return "major_including_agglomeration"
    return "other"


def aggregate_layer(path: Path, layer: str, batch_size: int = 25_000) -> pd.DataFrame:
    info = pyogrio.read_info(path, layer=layer)
    n = int(info.get("features") or 0)
    crs = info.get("crs")
    source_metric = parse_layer_name(layer)
    if source_metric is None:
        return pd.DataFrame()
    source, metric = source_metric

    frames = []
    for start in range(0, max(n, 1), batch_size):
        gdf = pyogrio.read_dataframe(
            path,
            layer=layer,
            skip_features=start,
            max_features=batch_size,
            columns=["category", "source", "countryCode"],
        )
        if gdf.empty:
            break
        # Contours are published in EPSG:3035 (metres) — area in m².
        if crs and "3035" not in str(crs):
            gdf = gdf.to_crs(3035)
        gdf = gdf.copy()
        gdf["area_m2"] = gdf.geometry.area
        grp = (
            gdf.groupby(["countryCode", "source", "category"], dropna=False)["area_m2"]
            .sum()
            .reset_index()
        )
        frames.append(grp)
        if len(gdf) < batch_size:
            break

    if not frames:
        return pd.DataFrame(
            columns=[
                "country",
                "source",
                "metric",
                "category",
                "urban_scope",
                "area_m2",
                "area_km2",
                "layer",
                "package",
            ]
        )

    out = pd.concat(frames, ignore_index=True)
    out = (
        out.groupby(["countryCode", "source", "category"], dropna=False)["area_m2"]
        .sum()
        .reset_index()
    )
    out = out.rename(columns={"countryCode": "country"})
    out["metric"] = metric
    out["urban_scope"] = urban_flag(source)
    out["area_km2"] = out["area_m2"] / 1e6
    out["layer"] = layer
    out["package"] = path.name
    return out[
        [
            "country",
            "source",
            "metric",
            "category",
            "urban_scope",
            "area_m2",
            "area_km2",
            "layer",
            "package",
        ]
    ]


def process_gpkg(path: Path, batch_size: int) -> pd.DataFrame:
    layers = [row[0] for row in pyogrio.list_layers(path)]
    parts = []
    for layer in layers:
        if parse_layer_name(layer) is None:
            continue
        print(f"  layer {layer}", flush=True)
        parts.append(aggregate_layer(path, layer, batch_size=batch_size))
    if not parts:
        return pd.DataFrame()
    return pd.concat(parts, ignore_index=True)


def extract_7z_if_needed(archive: Path, workdir: Path) -> list[Path]:
    workdir.mkdir(parents=True, exist_ok=True)
    # List contents
    listing = subprocess.check_output(["7z", "l", "-ba", str(archive)], text=True)
    gpkgs = []
    for line in listing.splitlines():
        # 7z -ba lines end with filename
        name = line.strip().split()[-1] if line.strip() else ""
        if name.lower().endswith(".gpkg"):
            gpkgs.append(name)
    if not gpkgs:
        # fallback extract all and glob
        subprocess.check_call(["7z", "x", f"-o{workdir}", "-y", str(archive)])
        return sorted(workdir.rglob("*.gpkg"))

    out_paths = []
    for name in gpkgs:
        dest = workdir / Path(name).name
        if dest.exists() and dest.stat().st_size > 1_000_000:
            out_paths.append(dest)
            continue
        subprocess.check_call(
            ["7z", "e", f"-o{workdir}", "-y", str(archive), name]
        )
        out_paths.append(workdir / Path(name).name)
    return out_paths


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {"processed_packages": {}, "notes": []}


def save_manifest(manifest: dict) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contours-dir", type=Path, default=CONT_DIR)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    parser.add_argument("--batch-size", type=int, default=25_000)
    parser.add_argument(
        "--only",
        default=None,
        help="Comma-separated package basenames to process (e.g. EE.gpkg,LV.gpkg,DE-gpkg.7z)",
    )
    parser.add_argument(
        "--reprocess",
        action="store_true",
        help="Recompute even if package already in manifest",
    )
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    expected = expected_size_map()
    # Refresh expected sizes from live listing fallback: use local complete files only
    only = None
    if args.only:
        only = {x.strip() for x in args.only.split(",") if x.strip()}

    manifest = load_manifest()
    all_rows: list[pd.DataFrame] = []
    existing_csv = args.out_dir / "contour_area_by_category.csv"
    if existing_csv.exists() and not args.reprocess:
        prev = pd.read_csv(existing_csv)
        # Drop packages we will recompute
        keep_packages = set(prev["package"].unique())
    else:
        prev = pd.DataFrame()
        keep_packages = set()

    packages = sorted(args.contours_dir.glob("*.gpkg")) + sorted(
        args.contours_dir.glob("*.7z")
    )
    for path in packages:
        if only is not None and path.name not in only:
            continue
        if path.suffix.lower() == ".gpkg" and not is_complete(path, expected):
            print(f"skip incomplete {path.name} ({path.stat().st_size} bytes)", flush=True)
            continue
        if path.suffix.lower() == ".7z":
            exp = expected.get(path.name)
            if exp and path.stat().st_size != exp:
                print(f"skip incomplete archive {path.name}", flush=True)
                continue

        prev_info = manifest["processed_packages"].get(path.name)
        if prev_info and not args.reprocess and path.name in keep_packages:
            print(f"already processed {path.name}", flush=True)
            continue

        print(f"processing {path.name}", flush=True)
        try:
            if path.suffix.lower() == ".7z":
                with tempfile.TemporaryDirectory(prefix="end-contours-") as tmp:
                    extracted = extract_7z_if_needed(path, Path(tmp))
                    parts = [process_gpkg(p, args.batch_size) for p in extracted]
                    df = pd.concat(parts, ignore_index=True) if parts else pd.DataFrame()
            else:
                df = process_gpkg(path, args.batch_size)
        except Exception as exc:
            print(f"  FAILED {path.name}: {exc!r}", flush=True)
            manifest["notes"].append({"package": path.name, "error": repr(exc)})
            save_manifest(manifest)
            continue

        if df.empty:
            print(f"  no contour layers in {path.name}", flush=True)
            continue

        # Replace any previous rows for this package
        if not prev.empty:
            prev = prev[prev["package"] != path.name]
        all_rows.append(df)
        manifest["processed_packages"][path.name] = {
            "rows": int(len(df)),
            "countries": sorted(df["country"].dropna().astype(str).unique().tolist()),
            "bytes": path.stat().st_size,
        }
        # Incremental write
        combined = pd.concat([prev, *all_rows], ignore_index=True) if len(prev) or all_rows else df
        # If prev was empty and multiple all_rows, concat all_rows only
        if prev.empty:
            combined = pd.concat(all_rows, ignore_index=True)
        else:
            combined = pd.concat([prev, *all_rows], ignore_index=True)
        combined.to_csv(existing_csv, index=False)
        # country rollup
        rollup = (
            combined.groupby(
                ["country", "source", "metric", "category", "urban_scope"], dropna=False
            )[["area_m2", "area_km2"]]
            .sum()
            .reset_index()
        )
        rollup.to_csv(args.out_dir / "contour_area_by_country_source_category.csv", index=False)
        save_manifest(manifest)
        print(f"  wrote updates ({len(combined):,} detail rows)", flush=True)

    if existing_csv.exists():
        combined = pd.read_csv(existing_csv)
        by_metric_source = (
            combined.groupby(["metric", "source", "category"], dropna=False)["area_km2"]
            .sum()
            .reset_index()
        )
        by_metric_source.to_csv(
            args.out_dir / "contour_area_by_metric_source_category.csv", index=False
        )
        print(f"final detail rows: {len(combined):,}", flush=True)
    else:
        print("no packages processed yet", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
