import marimo

__generated_with = "0.25.2"
app = marimo.App(width="full")


@app.cell
def _():
    import marimo as mo

    mo.md(
        r"""
    ### Korea — Seoul daily Leq (road sites)

    Locked: **daily Leq**, **Seoul-only**, prefer **road (`도로`)** sites; zone class (`법적`) as context.  
    Only ~8 Seoul road sites — show individually (no forced collapse). No common-sounds lines.
    """
    )
    return (mo,)


@app.cell
def _():
    from pathlib import Path

    import matplotlib.pyplot as plt
    import pandas as pd

    ROOT = Path(__file__).resolve().parents[2]
    RAW = next((ROOT / "data" / "raw" / "korea").glob("*.csv"))
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
    return OUT, RAW, pd, plt


@app.cell
def _(OUT, RAW, mo, pd):
    raw = pd.read_csv(RAW, encoding="utf-8-sig")
    # Columns: 번호, 도시, 법적, 용도구분, 측정지점, 지역, 측정일, 소음도
    seoul = raw.loc[raw["도시"] == "서울특별시"].copy()
    seoul["date"] = pd.to_datetime(seoul["측정일"], errors="coerce")
    seoul["leq"] = pd.to_numeric(seoul["소음도"], errors="coerce")
    seoul = seoul.dropna(subset=["date", "leq"])
    road = seoul.loc[seoul["지역"] == "도로"].copy()
    road.to_csv(OUT / "korea_seoul_road_daily_leq.csv", index=False)
    mo.md(
        f"File `{RAW.name}` · Seoul rows **{len(seoul):,}** · road **{len(road):,}** · "
        f"sites **{road['측정지점'].nunique()}** · {road['date'].min().date()} → {road['date'].max().date()}"
    )
    return raw, road, seoul


@app.cell
def _(OUT, road, pd):
    site_summary = (
        road.groupby(["측정지점", "법적", "용도구분"], as_index=False)
        .agg(
            leq_median=("leq", "median"),
            leq_p90=("leq", lambda s: s.quantile(0.9)),
            leq_min=("leq", "min"),
            leq_max=("leq", "max"),
            days=("leq", "size"),
        )
        .sort_values("leq_median", ascending=False)
    )
    city_daily = (
        road.groupby("date", as_index=False)
        .agg(leq_median=("leq", "median"), n_sites=("측정지점", "nunique"))
        .sort_values("date")
    )
    site_summary.to_csv(OUT / "korea_seoul_road_site_summary.csv", index=False)
    city_daily.to_csv(OUT / "korea_seoul_road_city_daily.csv", index=False)
    return city_daily, site_summary


@app.cell
def _(city_daily, mo, plt, road, site_summary):
    fig, axes = plt.subplots(2, 1, figsize=(10, 6.5), constrained_layout=True, sharex=False)
    ax = axes[0]
    ax.plot(city_daily["date"], city_daily["leq_median"], color="#5a6a80", lw=1.2, ls="--", label="Seoul road median")
    # individual sites
    palette = [
        "#ff1744",
        "#ffea00",
        "#76ff03",
        "#00e5ff",
        "#ff00e5",
        "#3d5afe",
        "#ffffff",
        "#c27a3a",
    ]
    for i, site in enumerate(site_summary["측정지점"]):
        sub = road.loc[road["측정지점"] == site].sort_values("date")
        ax.plot(
            sub["date"],
            sub["leq"],
            color=palette[i % len(palette)],
            lw=1.1,
            alpha=0.85,
            label=site,
        )
    ax.set_title("Seoul 2024 · daily road Leq by site")
    ax.set_ylabel("Leq dB")
    ax.set_ylim(50, 80)
    ax.legend(frameon=False, fontsize=8, ncol=2, labelcolor="#c5d3ea")

    ax2 = axes[1]
    colors = {"가": "#76ff03", "나": "#ffea00", "다": "#ff1744"}
    bar_c = [colors.get(z, "#00e5ff") for z in site_summary["법적"]]
    ax2.barh(site_summary["측정지점"], site_summary["leq_median"], color=bar_c)
    ax2.set_xlabel("median Leq dB")
    ax2.set_title("Site median Leq (colour = legal zone 가/나/다)")
    ax2.invert_yaxis()
    mo.mpl.interactive(fig)
    return ax, ax2, bar_c, colors, fig, palette


@app.cell
def _(mo, site_summary):
    insights = {
        "n_sites": int(len(site_summary)),
        "loudest": site_summary.iloc[0][["측정지점", "법적", "leq_median"]].to_dict(),
        "calmest": site_summary.iloc[-1][["측정지점", "법적", "leq_median"]].to_dict(),
        "city_median_of_site_medians": float(site_summary["leq_median"].median()),
        "zone_counts": site_summary["법적"].value_counts().to_dict(),
    }
    mo.md(
        f"""
    Seoul road sites **{insights['n_sites']}**. Loudest {insights['loudest']}, calmest {insights['calmest']}.  
    Viz params: y **50–80**; all 8 site lines + dashed city median; zone class in bar colour; **Seoul-only**; **no** common-sounds lines.  
    Blocker: no lat/lon in this CSV.
    """
    )
    return (insights,)


@app.cell
def _(insights):
    insights
    return


if __name__ == "__main__":
    app.run()
