import marimo

__generated_with = "0.25.2"
app = marimo.App(width="full")


@app.cell
def _():
    import marimo as mo

    mo.md(
        r"""
    ### Paris — measured Ln / Lden (Bruitparif road sites)

    Locked: **Ln primary**, **Lden companion** at named road sites (keep sites — do not collapse périphérique).  
    No common-sounds reference lines.
    """
    )
    return (mo,)


@app.cell
def _():
    from pathlib import Path
    import re

    import matplotlib.pyplot as plt
    import pandas as pd

    ROOT = Path(__file__).resolve().parents[2]
    RAW = (
        ROOT
        / "data"
        / "raw"
        / "paris"
        / "bruit-evolution-de-l-indice-du-bruit-mesure-sur-des-stations-parisiennes.csv"
    )
    OUT = ROOT / "data" / "processed" / "absolute-cities"
    OUT.mkdir(parents=True, exist_ok=True)

    plt.rcParams.update(
        {
            "figure.facecolor": "#0b0f14",
            "axes.facecolor": "#0b0f14",
            "axes.edgecolor": "#4a5a70",
            "axes.labelcolor": "#c5d3ea",
            "xtick.color": "#9db0cc",
            "ytick.color": "#9db0cc",
            "text.color": "#c5d3ea",
            "axes.spines.top": False,
            "axes.spines.right": False,
            "font.size": 11,
        }
    )
    return OUT, RAW, Path, pd, plt, re


@app.cell
def _(OUT, RAW, mo, pd, re):
    wide = pd.read_csv(RAW, sep=";", encoding="utf-8-sig")
    year_col = "Année"
    records = []
    for col in wide.columns:
        if col == year_col:
            continue
        c = re.sub(r"\s+", " ", col).strip()
        metric = None
        if re.search(r"\bLn\b", c, re.I) or c.lower().startswith("ln_"):
            metric = "Ln"
        elif re.search(r"\bLden\b", c, re.I) or c.lower().startswith("lden"):
            metric = "Lden"
        if metric is None:
            continue
        site = re.sub(r"\s*[-–]?\s*L(?:den|n)\s*dB\(A\)\s*$", "", c, flags=re.I)
        site = re.sub(r"^(?:lden|ln)[_\s]*bruit\s*routier[_\s]*", "", site, flags=re.I)
        site = site.strip(" -_") or c
        for _, row in wide.iterrows():
            val = row[col]
            if pd.isna(val) or str(val).strip() == "":
                continue
            records.append(
                {
                    "year": int(row[year_col]),
                    "site": site,
                    "metric": metric,
                    "db": float(val),
                    "source_col": col,
                }
            )
    long = pd.DataFrame(records).sort_values(["metric", "site", "year"])
    long.to_csv(OUT / "paris_ln_lden_long.csv", index=False)
    mo.md(
        f"Sites **{long['site'].nunique()}** · years **{sorted(long['year'].unique())}** · "
        f"rows **{len(long)}** (Ln { (long.metric=='Ln').sum() }, Lden {(long.metric=='Lden').sum() })"
    )
    return long, wide


@app.cell
def _(OUT, long, pd):
    ln = long.loc[long["metric"] == "Ln"].copy()
    # Latest year snapshot for ranking
    latest = int(ln["year"].max())
    snap = ln.loc[ln["year"] == latest].sort_values("db", ascending=False)
    # Keep named big roads distinct — pick loudest, a périphérique if present, calmest
    peri = snap.loc[snap["site"].str.contains("Périphérique|Peripherique", case=False, na=False)]
    focus_sites = []
    if len(snap):
        focus_sites.append(snap.iloc[0]["site"])  # loudest
    # Second périphérique segment if loudest already is one (keep names distinct)
    for _, row in peri.iterrows():
        if row["site"] not in focus_sites:
            focus_sites.append(row["site"])
            break
    if len(snap):
        calm = snap.iloc[-1]["site"]
        if calm not in focus_sites:
            focus_sites.append(calm)
    # Fill to 3 with next-loudest if needed
    for _, row in snap.iterrows():
        if len(focus_sites) >= 3:
            break
        if row["site"] not in focus_sites:
            focus_sites.append(row["site"])
    focus_sites = focus_sites[:3]
    focus = ln.loc[ln["site"].isin(focus_sites)]
    snap.to_csv(OUT / "paris_ln_latest_snapshot.csv", index=False)
    pd.DataFrame({"site": focus_sites}).to_csv(OUT / "paris_ln_focus_sites.csv", index=False)
    return focus, focus_sites, latest, ln, peri, snap


@app.cell
def _(focus, focus_sites, latest, ln, long, mo, plt, snap):
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.4), constrained_layout=True)
    ax = axes[0]
    palette = ["#ff1744", "#ffea00", "#76ff03", "#00e5ff"]
    for i, site in enumerate(focus_sites):
        sub = focus.loc[focus["site"] == site]
        ax.plot(sub["year"], sub["db"], lw=2.2, color=palette[i % len(palette)], label=site[:42])
    ax.set_title(f"Paris Ln — focus sites")
    ax.set_ylabel("Ln dB(A)")
    ax.set_ylim(55, 85)
    ax.legend(frameon=False, fontsize=8, labelcolor="#c5d3ea")

    ax2 = axes[1]
    # All sites latest Ln vs Lden
    lden_latest = long.loc[(long["metric"] == "Lden") & (long["year"] == latest)]
    merged = snap.merge(
        lden_latest[["site", "db"]].rename(columns={"db": "lden"}),
        on="site",
        how="left",
    )
    ax2.scatter(merged["lden"], merged["db"], c="#00e5ff", s=36, alpha=0.9)
    for _, r in merged.iterrows():
        if r["site"] in focus_sites:
            ax2.annotate(r["site"][:28], (r["lden"], r["db"]), fontsize=7, color="#c5d3ea")
    ax2.set_xlabel(f"Lden {latest}")
    ax2.set_ylabel(f"Ln {latest}")
    ax2.set_title("Ln vs Lden (latest year, all sites)")
    mo.mpl.interactive(fig)
    return ax, ax2, fig, lden_latest, merged, palette


@app.cell
def _(focus_sites, latest, ln, mo, snap):
    insights = {
        "latest_year": latest,
        "n_sites_ln_latest": int(len(snap)),
        "loudest_ln": snap.iloc[0][["site", "db"]].to_dict() if len(snap) else None,
        "calmest_ln": snap.iloc[-1][["site", "db"]].to_dict() if len(snap) else None,
        "focus_sites": focus_sites,
        "city_median_ln_latest": float(snap["db"].median()) if len(snap) else None,
    }
    mo.md(
        f"""
    **{latest} Ln:** loudest **{insights['loudest_ln']}**, calmest **{insights['calmest_ln']}**,
    site median **{insights['city_median_ln_latest']}** dB. Focus sites kept named (no merge of périphérique).

    Viz params: Ln y **55–85**; Lden companion scatter/small multiples; **no** common-sounds lines.
    """
    )
    return (insights,)


@app.cell
def _(insights):
    insights
    return


if __name__ == "__main__":
    app.run()
