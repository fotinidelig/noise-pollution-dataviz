import marimo

__generated_with = "0.25.2"
app = marimo.App(width="full")


@app.cell
def _():
    import marimo as mo

    mo.md(
        r"""
    ### EEA END 2022 — exposure & contour area EDA

    Europe environmental noise (Environmental Noise Directive reporting round **2022**,
    exposure workbook cutoff **2024-11-18** / published Aug 2025; contours Mar 2026).

    Scope for this notebook:

    - People exposed by **5 dB bands** for **Lden** and **Lnight**
    - Source shares (road / rail / air / industry) in agglomerations
    - Country aggregates
    - Contour-derived **area** summaries by dB class × source × country (where packages are processed)

    Children BoD is **out of scope**. No website / PMTiles work here.
    """
    )
    return (mo,)


@app.cell
def _():
    from pathlib import Path

    import matplotlib.pyplot as plt
    import pandas as pd
    import seaborn as sns

    ROOT = Path(__file__).resolve().parents[2]
    PROC = ROOT / "data" / "processed" / "eea-end"

    sns.set_theme(style="ticks", context="notebook")
    plt.rcParams.update(
        {
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "axes.spines.top": False,
            "axes.spines.right": False,
            "font.size": 11,
        }
    )
    SOURCE_ORDER = ["road", "rail", "air", "industry"]
    SOURCE_COLORS = {
        "road": "#1f4e5f",
        "rail": "#5c8a6b",
        "air": "#c27a3a",
        "industry": "#7a6f64",
        "major_road": "#1f4e5f",
        "major_rail": "#5c8a6b",
        "major_air": "#c27a3a",
    }
    return PROC, SOURCE_COLORS, SOURCE_ORDER, pd, plt


@app.cell
def _(PROC, mo, pd):
    files = {
        "aggl_long": PROC / "exposure_agglomeration_long.csv",
        "aggl_country": PROC / "exposure_aggl_end_by_country_source_metric.csv",
        "aggl_band": PROC / "exposure_aggl_end_by_band.csv",
        "aggl_share": PROC / "exposure_aggl_source_share.csv",
        "major_country": PROC / "exposure_major_outside_end_by_country.csv",
        "contour_area": PROC / "contour_area_by_country_source_category.csv",
        "contour_metric": PROC / "contour_area_by_metric_source_category.csv",
    }
    missing = [p.name for p in files.values() if not p.exists()]
    tables = {k: pd.read_csv(p) for k, p in files.items() if p.exists()}
    mo.md(
        f"Loaded **{len(tables)}** processed tables from `{PROC}`."
        + (f" Missing: `{', '.join(missing)}`." if missing else "")
    )
    return (tables,)


@app.cell
def _(mo):
    mo.md(r"""
    ### Agglomeration exposure — source shares

    People in END agglomerations (>100k) exposed in official END bands
    (**Lden ≥55**, **Lnight ≥50**), summed across bands.
    """)
    return


@app.cell
def _(SOURCE_COLORS, SOURCE_ORDER, plt, tables):
    share = tables["aggl_share"].copy()
    fig, axes = plt.subplots(1, 2, figsize=(10, 4), sharey=True)
    for _ax, _metric in zip(axes, ["Lden", "Lnight"]):
        _d = share[share["metric"] == _metric].set_index("source").reindex(SOURCE_ORDER)
        colors = [SOURCE_COLORS[s] for s in _d.index]
        _ax.bar(_d.index, _d["people_exposed_end_bands"] / 1e6, color=colors)
        _ax.set_title(_metric)
        _ax.set_ylabel("People exposed (millions)" if _metric == "Lden" else "")
        for x, y in enumerate(_d["people_exposed_end_bands"] / 1e6):
            if y != y:  # NaN
                continue
            _ax.text(x, y, f"{y:.1f}", ha="center", va="bottom", fontsize=9)
    fig.suptitle("Agglomeration exposure by source (END bands)", y=1.02)
    fig.tight_layout()
    fig
    return (share,)


@app.cell
def _(SOURCE_ORDER, plt, tables):
    band = tables["aggl_band"].copy()
    band["band"] = band["band"].astype(str)
    lden_order = ["55-59", "60-64", "65-69", "70-74", ">75"]
    lnight_order = ["50-54", "55-59", "60-64", "65-69", ">70"]

    fig2, axes2 = plt.subplots(1, 2, figsize=(11, 4))
    for _ax, _metric, order in zip(
        axes2, ["Lden", "Lnight"], [lden_order, lnight_order]
    ):
        _d = band[band["metric"] == _metric]
        # facet by source as grouped bars for road/rail primarily
        pivot = (
            _d.pivot_table(index="band", columns="source", values="people", aggfunc="sum")
            .reindex(order)
            .reindex(columns=[c for c in SOURCE_ORDER if c in _d["source"].unique()])
        )
        pivot.plot(
            kind="bar",
            ax=_ax,
            color=["#1f4e5f", "#5c8a6b", "#c27a3a", "#7a6f64"][: len(pivot.columns)],
            width=0.8,
        )
        _ax.set_title(_metric)
        _ax.set_xlabel("dB band")
        _ax.set_ylabel("People" if _metric == "Lden" else "")
        _ax.legend(title="source", frameon=False, fontsize=8)
        _ax.tick_params(axis="x", rotation=0)
    fig2.suptitle("People by 5 dB band (agglomerations)", y=1.02)
    fig2.tight_layout()
    fig2
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### Country aggregates — road noise in agglomerations
    """)
    return


@app.cell
def _(plt, tables):
    by = tables["aggl_country"].copy()
    road = by[(by["source"] == "road")].copy()
    fig3, axes3 = plt.subplots(1, 2, figsize=(12, 5))
    for _ax, _metric in zip(axes3, ["Lden", "Lnight"]):
        _d = (
            road[road["metric"] == _metric]
            .sort_values("people_exposed_end_bands", ascending=True)
            .tail(15)
        )
        _ax.barh(_d["country"], _d["people_exposed_end_bands"] / 1e6, color="#1f4e5f")
        _ax.set_title(f"Road · {_metric}")
        _ax.set_xlabel("People exposed (millions)")
    fig3.suptitle("Top countries — agglomeration road exposure (END bands)", y=1.02)
    fig3.tight_layout()
    fig3
    return (by,)


@app.cell
def _(mo):
    mo.md(r"""
    ### Lden vs Lnight

    For each country × source in agglomerations, compare END-band people totals.
    Points above the diagonal have relatively higher daytime-evening exposure;
    night totals are usually lower because the Lnight metric and bands differ.
    """)
    return


@app.cell
def _(SOURCE_COLORS, by, plt):
    wide = (
        by.pivot_table(
            index=["country", "source"],
            columns="metric",
            values="people_exposed_end_bands",
            aggfunc="sum",
        )
        .dropna(subset=["Lden", "Lnight"])
        .reset_index()
    )
    fig4, ax4 = plt.subplots(figsize=(6.5, 6))
    for source, g in wide.groupby("source"):
        ax4.scatter(
            g["Lden"] / 1e6,
            g["Lnight"] / 1e6,
            s=35,
            alpha=0.75,
            label=source,
            c=SOURCE_COLORS.get(source, "#333"),
        )
    lim = max(wide["Lden"].max(), wide["Lnight"].max()) / 1e6 * 1.05
    ax4.plot([0, lim], [0, lim], ls="--", lw=1, color="#999")
    ax4.set_xlabel("Lden people (millions)")
    ax4.set_ylabel("Lnight people (millions)")
    ax4.set_title("Country × source: Lden vs Lnight (agglomerations)")
    ax4.legend(frameon=False)
    fig4.tight_layout()
    fig4
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### Major sources outside agglomerations

    Country totals for major roads / railways / airports (**outside** agglomerations),
    END bands.
    """)
    return


@app.cell
def _(SOURCE_COLORS, plt, tables):
    major = tables["major_country"].rename(
        columns={"people_exposed_end_bands_outside_aggl": "people"}
    )
    fig5, axes5 = plt.subplots(1, 2, figsize=(12, 5))
    for _ax, _metric in zip(axes5, ["Lden", "Lnight"]):
        _d = (
            major[major["metric"] == _metric]
            .groupby("source", as_index=False)["people"]
            .sum()
            .sort_values("people", ascending=False)
        )
        _ax.bar(
            _d["source"],
            _d["people"] / 1e6,
            color=[SOURCE_COLORS.get(s, "#444") for s in _d["source"]],
        )
        _ax.set_title(_metric)
        _ax.set_ylabel("People (millions)" if _metric == "Lden" else "")
        _ax.tick_params(axis="x", rotation=20)
    fig5.suptitle("Major-source exposure outside agglomerations", y=1.02)
    fig5.tight_layout()
    fig5
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### Contour area summaries

    Vector contours → summed polygon area by **category (dB class) × source × country**.
    These are geometric areas (EPSG:3035), **not** population. Overlapping band polygons
    are summed independently (END band polygons as published).
    """)
    return


@app.cell
def _(mo, tables):
    if "contour_area" not in tables:
        contour = None
        contour_summary = mo.md(
            "_Contour area table not available yet — waiting for processed packages._"
        )
    else:
        contour = tables["contour_area"].copy()
        n_countries = contour["country"].nunique()
        contour_summary = mo.md(
            f"Contour rows: **{len(contour):,}** · countries in table: **{n_countries}**."
        )
    contour_summary
    return (contour,)


@app.cell
def _(contour, plt):
    if contour is None or contour.empty:
        fig6 = None
    else:
        # Normalize source labels for plotting
        c = contour.copy()
        c["source_family"] = (
            c["source"]
            .astype(str)
            .str.replace("InAgglomeration", "", regex=False)
            .str.replace("IncludingAgglomeration", "", regex=False)
            .str.replace("major", "major_", regex=False)
        )
        metric_pref = "Lden" if (c["metric"] == "Lden").any() else c["metric"].iloc[0]
        _d = (
            c[c["metric"] == metric_pref]
            .groupby("country", as_index=False)["area_km2"]
            .sum()
            .sort_values("area_km2", ascending=True)
            .tail(15)
        )
        fig6, ax6 = plt.subplots(figsize=(8, 5))
        ax6.barh(_d["country"], _d["area_km2"], color="#1f4e5f")
        ax6.set_xlabel("Contour area (km², all sources/bands summed)")
        ax6.set_title(f"Processed countries — total contour area ({metric_pref})")
        fig6.tight_layout()
    fig6
    return


@app.cell
def _(plt, tables):
    if "contour_metric" not in tables or tables["contour_metric"].empty:
        fig7 = None
    else:
        cm = tables["contour_metric"].copy()
        # Focus on in-agglomeration road-like layers if present
        roadish = cm[cm["source"].astype(str).str.contains("road", case=False, na=False)]
        fig7, axes7 = plt.subplots(1, 2, figsize=(12, 4), sharey=False)
        for _ax, _metric in zip(axes7, ["Lden", "Lnight"]):
            _d = roadish[roadish["metric"] == _metric].copy()
            if _d.empty:
                _ax.set_visible(False)
                continue
            _d = _d.groupby("category", as_index=False)["area_km2"].sum()
            _d = _d.sort_values("category")
            _ax.plot(_d["category"], _d["area_km2"], marker="o", color="#1f4e5f")
            _ax.set_title(f"Road-related contour area · {_metric}")
            _ax.tick_params(axis="x", rotation=45)
            _ax.set_ylabel("km²")
        fig7.suptitle("Area by dB class (road-related layers, processed packages)", y=1.02)
        fig7.tight_layout()
    fig7
    return


@app.cell
def _(by, contour, mo, share):
    # Key finding bullets derived from current processed tables
    road_lden = float(
        share.loc[
            (share["metric"] == "Lden") & (share["source"] == "road"),
            "people_exposed_end_bands",
        ].sum()
    )
    road_share = road_lden / float(
        share.loc[share["metric"] == "Lden", "people_exposed_end_bands"].sum()
    )
    top = (
        by[(by["source"] == "road") & (by["metric"] == "Lden")]
        .sort_values("people_exposed_end_bands", ascending=False)
        .head(3)
    )
    top_txt = ", ".join(
        f"{r.country} ({r.people_exposed_end_bands/1e6:.1f}M)" for r in top.itertuples()
    )
    n_cont = 0 if contour is None else contour["country"].nunique()
    mo.md(
        f"""
    ### Key findings (from processed tables)

    - Road dominates agglomeration END-band exposure: **~{road_lden/1e6:.0f}M** people Lden
      (**{road_share:.0%}** of summed source totals in this workbook rollup).
    - Lnight road exposure is lower but still dominant (**~{float(share.loc[(share.metric=='Lnight')&(share.source=='road'),'people_exposed_end_bands'].sum())/1e6:.0f}M**).
    - Largest agglomeration road Lden countries: **{top_txt}**.
    - Contour area tables currently cover **{n_cont}** country code(s) — re-run
      `analysis/scripts/process_contours.py` as downloads finish to refresh.
    """
    )
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### Reproduce

    ```bash
    cd analysis
    source .venv/bin/activate
    python scripts/process_exposure.py
    python scripts/process_contours.py
    marimo edit notebooks/end_2022_exposure_contours_eda.py
    ```
    """)
    return


if __name__ == "__main__":
    app.run()
