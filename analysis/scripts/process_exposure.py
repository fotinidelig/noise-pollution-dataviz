#!/usr/bin/env python3
"""Parse EEA END 2022 exposure Excel into tidy CSVs under data/processed/eea-end/."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parents[2]
DEFAULT_XLSX = (
    REPO
    / "data"
    / "raw"
    / "eea-end"
    / "exposure"
    / "Summary_END_2022_cutoff241118_v4.xlsx"
)
OUT_DIR = REPO / "data" / "processed" / "eea-end"

AGGL_SHEETS = {
    "Aggl_Road_Data": "road",
    "Aggl_Rail_Data": "rail",
    "Aggl_Air_Data": "air",
    "Aggl_Ind_Data": "industry",
}

MAJOR_SHEETS = {
    "MRoad_Data": "major_road",
    "MRail_Data": "major_rail",
}


def _to_num(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return pd.NA
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s or s.lower() in {
        "no data",
        "no data ",
        "not applicable",
        "n/a",
        "-",
    }:
        return pd.NA
    if "no major" in s.lower():
        return pd.NA
    try:
        return float(s.replace(" ", "").replace(",", ""))
    except ValueError:
        return pd.NA


def _norm_band(label: str) -> str:
    return re.sub(r"\s+", "", str(label)).strip()


def parse_agglomeration_sheet(xlsx: Path, sheet: str, source: str) -> pd.DataFrame:
    raw = pd.read_excel(xlsx, sheet_name=sheet, header=None)
    # Row 5 (0-based index 5) has column labels; row 4 has group labels.
    header = raw.iloc[5].tolist()
    group = raw.iloc[4].tolist()
    # Forward-fill group labels across merged cells.
    group_ffill = []
    last = None
    for g in group:
        if pd.notna(g) and str(g).strip():
            last = str(g).strip()
        group_ffill.append(last)

    records = []
    for _, row in raw.iloc[6:].iterrows():
        country = row.iloc[0]
        if pd.isna(country) or not str(country).strip():
            continue
        meta = {
            "country": str(country).strip(),
            "eu": row.iloc[1],
            "agglomeration": row.iloc[2],
            "inhabitants": _to_num(row.iloc[3]),
            "area_km2": _to_num(row.iloc[4]),
            "source": source,
            "scope": "agglomeration",
        }
        for i in range(5, min(len(header), 33)):
            band = header[i]
            grp = group_ffill[i] or ""
            if pd.isna(band) or not str(band).strip():
                continue
            band_s = _norm_band(band)
            if band_s.lower().startswith("df") or band_s.lower() in {"url", "datasource"}:
                continue
            if "LdenM" in grp or "major noise bands (LdenM)" in grp:
                metric, kind = "Lden", "people_major_bands"
            elif "LnightM" in grp or "major noise bands (LnightM)" in grp:
                metric, kind = "Lnight", "people_major_bands"
            elif "Lden" in grp and "Lnight" not in grp:
                metric, kind = "Lden", "people"
            elif "Lnight" in grp:
                metric, kind = "Lnight", "people"
            else:
                continue
            records.append(
                {
                    **meta,
                    "metric": metric,
                    "band": band_s,
                    "measure": kind,
                    "value": _to_num(row.iloc[i]),
                }
            )
    return pd.DataFrame.from_records(records)


def parse_major_country_sheet(xlsx: Path, sheet: str, source: str) -> pd.DataFrame:
    raw = pd.read_excel(xlsx, sheet_name=sheet, header=None)
    # Rows: 3 group, 4 subgroup?, actually 3=outside/including, 4=measure groups, 5=bands
    header = raw.iloc[4].tolist()
    # Build column roles from rows 2-4
    outside_incl = []
    last = None
    for v in raw.iloc[2].tolist():
        if pd.notna(v) and str(v).strip():
            last = str(v).strip()
        outside_incl.append(last)
    measure = []
    last = None
    for v in raw.iloc[3].tolist():
        if pd.notna(v) and str(v).strip():
            last = str(v).strip()
        measure.append(last)

    records = []
    for _, row in raw.iloc[5:].iterrows():
        country = row.iloc[0]
        if pd.isna(country) or not str(country).strip():
            continue
        country_s = str(country).strip()
        # Skip narrative non-data rows
        if country_s.lower().startswith("no "):
            continue
        meta = {
            "country": country_s,
            "eu": row.iloc[1],
            "network_km": _to_num(row.iloc[2]),
            "source": source,
            "scope": "major_country",
        }
        for i in range(3, min(len(header), 26)):
            band = header[i]
            if pd.isna(band) or not str(band).strip():
                continue
            band_s = _norm_band(band)
            if band_s.lower().startswith("df") or band_s.lower() in {"url", "datasource"}:
                continue
            m = measure[i] or ""
            oi = outside_incl[i] or ""
            if "Lden" in m and "Lnight" not in m and "Area" not in m and "dwelling" not in m.lower():
                metric, kind = "Lden", "people"
            elif "Lnight" in m and "Area" not in m and "dwelling" not in m.lower():
                metric, kind = "Lnight", "people"
            elif "Area" in m and "Lden" in m:
                metric, kind = "Lden", "area_km2"
            elif "dwelling" in m.lower():
                metric, kind = "Lden", "dwellings"
            else:
                continue
            # For threshold columns like >55/>65/>75 under area/including blocks
            scope = "outside_agglomerations" if oi.lower().startswith("outside") else (
                "including_agglomerations" if oi.lower().startswith("including") else "unspecified"
            )
            records.append(
                {
                    **meta,
                    "reporting_scope": scope,
                    "metric": metric,
                    "band": band_s,
                    "measure": kind,
                    "value": _to_num(row.iloc[i]),
                }
            )
    return pd.DataFrame.from_records(records)


def parse_major_airports(xlsx: Path) -> pd.DataFrame:
    raw = pd.read_excel(xlsx, sheet_name="MAir_Data", header=None)
    header = raw.iloc[4].tolist()
    outside_incl = []
    last = None
    for v in raw.iloc[2].tolist():
        if pd.notna(v) and str(v).strip():
            last = str(v).strip()
        outside_incl.append(last)
    measure = []
    last = None
    for v in raw.iloc[3].tolist():
        if pd.notna(v) and str(v).strip():
            last = str(v).strip()
        measure.append(last)

    records = []
    for _, row in raw.iloc[5:].iterrows():
        country = row.iloc[0]
        if pd.isna(country) or not str(country).strip():
            continue
        country_s = str(country).strip()
        icao = row.iloc[2]
        if isinstance(icao, str) and "no major" in icao.lower():
            continue
        meta = {
            "country": country_s,
            "eu": row.iloc[1],
            "icao": icao,
            "movements": _to_num(row.iloc[3]),
            "airport": row.iloc[4],
            "source": "major_air",
            "scope": "major_airport",
        }
        for i in range(5, min(len(header), 26)):
            band = header[i]
            if pd.isna(band) or not str(band).strip():
                continue
            band_s = _norm_band(band)
            m = measure[i] or ""
            oi = outside_incl[i] or ""
            if "Lden" in m and "Lnight" not in m and "Area" not in m and "dwelling" not in m.lower():
                metric, kind = "Lden", "people"
            elif "Lnight" in m and "Area" not in m:
                metric, kind = "Lnight", "people"
            elif "Area" in m:
                metric, kind = "Lden", "area_km2"
            elif "dwelling" in m.lower():
                metric, kind = "Lden", "dwellings"
            else:
                continue
            scope = "outside_agglomerations" if (oi or "").lower().startswith("outside") else (
                "including_agglomerations"
                if (oi or "").lower().startswith("including")
                else "unspecified"
            )
            records.append(
                {
                    **meta,
                    "reporting_scope": scope,
                    "metric": metric,
                    "band": band_s,
                    "measure": kind,
                    "value": _to_num(row.iloc[i]),
                }
            )
    return pd.DataFrame.from_records(records)


def build_summaries(aggl: pd.DataFrame, major: pd.DataFrame) -> dict[str, pd.DataFrame]:
    # Official END thresholds commonly used: Lden >=55, Lnight >=50
    aggl_people = aggl[aggl["measure"] == "people"].copy()

    def band_ge_lden55(b: str) -> bool:
        b = b.strip()
        return b in {"55-59", "60-64", "65-69", "70-74", ">75"} or b.startswith("Lden")

    # For agglomeration bands already normalized like 55-59
    def keep_end_lden(b: str) -> bool:
        return b in {"55-59", "60-64", "65-69", "70-74", ">75"}

    def keep_end_lnight(b: str) -> bool:
        return b in {"50-54", "55-59", "60-64", "65-69", ">70"}

    aggl_end = aggl_people[
        ((aggl_people["metric"] == "Lden") & aggl_people["band"].map(keep_end_lden))
        | ((aggl_people["metric"] == "Lnight") & aggl_people["band"].map(keep_end_lnight))
    ].copy()

    by_country_source_metric = (
        aggl_end.groupby(["country", "source", "metric"], dropna=False)["value"]
        .sum(min_count=1)
        .reset_index()
        .rename(columns={"value": "people_exposed_end_bands"})
    )
    by_band = (
        aggl_end.groupby(["source", "metric", "band"], dropna=False)["value"]
        .sum(min_count=1)
        .reset_index()
        .rename(columns={"value": "people"})
    )
    source_share = (
        by_country_source_metric.groupby(["metric", "source"])["people_exposed_end_bands"]
        .sum(min_count=1)
        .reset_index()
    )

    major_people = major[major["measure"] == "people"].copy()
    major_end = major_people[
        (
            (major_people["metric"] == "Lden")
            & major_people["band"].map(keep_end_lden)
            & (major_people["reporting_scope"] == "outside_agglomerations")
        )
        | (
            (major_people["metric"] == "Lnight")
            & major_people["band"].map(keep_end_lnight)
            & (major_people["reporting_scope"] == "outside_agglomerations")
        )
    ].copy()
    major_by_country = (
        major_end.groupby(["country", "source", "metric"], dropna=False)["value"]
        .sum(min_count=1)
        .reset_index()
        .rename(columns={"value": "people_exposed_end_bands_outside_aggl"})
    )

    return {
        "exposure_agglomeration_long": aggl,
        "exposure_major_long": major,
        "exposure_aggl_end_by_country_source_metric": by_country_source_metric,
        "exposure_aggl_end_by_band": by_band,
        "exposure_aggl_source_share": source_share,
        "exposure_major_outside_end_by_country": major_by_country,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    aggl_parts = [
        parse_agglomeration_sheet(args.xlsx, sheet, source)
        for sheet, source in AGGL_SHEETS.items()
    ]
    aggl = pd.concat(aggl_parts, ignore_index=True)

    major_parts = [
        parse_major_country_sheet(args.xlsx, sheet, source)
        for sheet, source in MAJOR_SHEETS.items()
    ]
    major_parts.append(parse_major_airports(args.xlsx))
    major = pd.concat(major_parts, ignore_index=True)

    tables = build_summaries(aggl, major)
    for name, df in tables.items():
        path = args.out_dir / f"{name}.csv"
        df.to_csv(path, index=False)
        print(f"wrote {path} ({len(df):,} rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
