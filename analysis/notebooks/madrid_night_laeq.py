import marimo

__generated_with = "0.25.2"
app = marimo.App(width="full")


@app.cell
def _():
    import marimo as mo

    mo.md(
        r"""
    ### Madrid — night LAeq (SIVCA)

    Locked metrics: **Periodo N (night) LAeq** primary; **L10 − L90** secondary when present.  
    Story focus: **2–3 stations** (loudest / calmest / distinctive), with light city-wide context.  
    No common-sounds reference lines. No station coordinates in this dump.
    """
    )
    return (mo,)


@app.cell
def _():
    from pathlib import Path

    import matplotlib.pyplot as plt
    import pandas as pd

    ROOT = Path(__file__).resolve().parents[2]
    RAW = ROOT / "data" / "raw" / "madrid" / "Ruido_diario_acumulado.csv"
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
def _(RAW, mo, pd):
    usecols = ["Estación", "Año", "Mes", "Día", "Periodo", "LAeq", "L10", "L90"]
    raw = pd.read_csv(
        RAW,
        sep=";",
        encoding="latin-1",
        usecols=usecols,
        dtype={
            "Estación": "int16",
            "Año": "int16",
            "Mes": "int8",
            "Día": "int8",
            "Periodo": "category",
        },
        na_values=["N/D", "ND", ""],
        decimal=",",
    )
    night = raw.loc[raw["Periodo"] == "N"].copy()
    night["date"] = pd.to_datetime(
        dict(year=night["Año"], month=night["Mes"], day=night["Día"]),
        errors="coerce",
    )
    night = night.dropna(subset=["date", "LAeq"])
    night["spread"] = night["L10"] - night["L90"]
    mo.md(
        f"Night rows **{len(night):,}** · stations **{night['Estación'].nunique()}** · "
        f"{night['date'].min().date()} → {night['date'].max().date()}"
    )
    return (night,)


@app.cell
def _(OUT, night, pd):
    station_overall = (
        night.groupby("Estación", as_index=False)
        .agg(
            laeq_median=("LAeq", "median"),
            laeq_p90=("LAeq", lambda s: s.quantile(0.9)),
            spread_median=("spread", "median"),
            nights=("LAeq", "size"),
            year_min=("Año", "min"),
            year_max=("Año", "max"),
        )
        .sort_values("laeq_median", ascending=False)
    )
    eligible = station_overall.loc[
        (station_overall["nights"] >= 1000) & (station_overall["year_max"] >= 2020)
    ].copy()
    if eligible.empty:
        eligible = station_overall.copy()

    loudest = int(eligible.iloc[0]["Estación"])
    calmest = int(eligible.iloc[-1]["Estación"])
    spread_rank = eligible.dropna(subset=["spread_median"]).sort_values(
        "spread_median", ascending=False
    )
    distinctive = loudest
    for sid in spread_rank["Estación"].astype(int):
        if sid not in {loudest, calmest}:
            distinctive = int(sid)
            break
    if distinctive in {loudest, calmest} and len(eligible) > 2:
        distinctive = int(eligible.iloc[1]["Estación"])

    focus_ids = []
    for sid in (loudest, distinctive, calmest):
        if sid not in focus_ids:
            focus_ids.append(sid)

    city_yearly = (
        night.groupby("Año", as_index=False)
        .agg(laeq_median=("LAeq", "median"), spread_median=("spread", "median"))
        .sort_values("Año")
    )
    focus_yearly = (
        night.loc[night["Estación"].isin(focus_ids)]
        .groupby(["Estación", "Año"], as_index=False)
        .agg(
            laeq_median=("LAeq", "median"),
            spread_median=("spread", "median"),
            nights=("LAeq", "size"),
        )
        .sort_values(["Estación", "Año"])
    )

    station_overall.to_csv(OUT / "madrid_night_laeq_stations.csv", index=False)
    city_yearly.to_csv(OUT / "madrid_night_laeq_city_yearly.csv", index=False)
    focus_yearly.to_csv(OUT / "madrid_night_laeq_focus_yearly.csv", index=False)
    pd.DataFrame(
        {
            "role": ["loudest", "distinctive_spread", "calmest"][: len(focus_ids)],
            "Estación": focus_ids,
        }
    ).to_csv(OUT / "madrid_night_laeq_focus_ids.csv", index=False)
    return (
        calmest,
        city_yearly,
        distinctive,
        eligible,
        focus_ids,
        focus_yearly,
        loudest,
        station_overall,
    )


@app.cell
def _(city_yearly, focus_ids, focus_yearly, mo, plt, station_overall):
    palette = {focus_ids[0]: "#ff1744", focus_ids[-1]: "#76ff03"}
    if len(focus_ids) > 2:
        palette[focus_ids[1]] = "#ffea00"

    fig, ax = plt.subplots(figsize=(10, 4.5), constrained_layout=True)
    ax.plot(
        city_yearly["Año"],
        city_yearly["laeq_median"],
        color="#5a6a80",
        lw=1.5,
        ls="--",
        label="city median (context)",
        zorder=1,
    )
    for sid in focus_ids:
        sub = focus_yearly.loc[focus_yearly["Estación"] == sid]
        med = float(
            station_overall.loc[station_overall["Estación"] == sid, "laeq_median"].iloc[0]
        )
        ax.plot(
            sub["Año"],
            sub["laeq_median"],
            color=palette.get(sid, "#00e5ff"),
            lw=2.2,
            label=f"st {sid} (med {med:.1f} dB)",
            zorder=2,
        )
    ax.set_title("Madrid night LAeq — focus stations vs city median")
    ax.set_ylabel("dB(A)")
    ax.set_xlabel("year")
    ax.set_ylim(45, 75)
    ax.legend(frameon=False, labelcolor="#c5d3ea", fontsize=9)
    mo.mpl.interactive(fig)
    return ax, fig, palette


@app.cell
def _(
    calmest,
    city_yearly,
    distinctive,
    focus_ids,
    loudest,
    mo,
    night,
    pd,
    station_overall,
):
    meta = station_overall.set_index("Estación")
    recent_spread = night.loc[
        (night["Estación"].isin(focus_ids)) & (night["Año"] >= 2020), "spread"
    ].median()
    insights = {
        "focus_ids": focus_ids,
        "loudest": loudest,
        "distinctive": distinctive,
        "calmest": calmest,
        "loudest_median": float(meta.loc[loudest, "laeq_median"]),
        "calmest_median": float(meta.loc[calmest, "laeq_median"]),
        "distinctive_median": float(meta.loc[distinctive, "laeq_median"]),
        "distinctive_spread": (
            float(meta.loc[distinctive, "spread_median"])
            if pd.notna(meta.loc[distinctive, "spread_median"])
            else None
        ),
        "city_first": float(city_yearly.iloc[0]["laeq_median"]),
        "city_last": float(city_yearly.iloc[-1]["laeq_median"]),
        "year_first": int(city_yearly.iloc[0]["Año"]),
        "year_last": int(city_yearly.iloc[-1]["Año"]),
        "recent_focus_spread_median": (
            float(recent_spread) if pd.notna(recent_spread) else None
        ),
    }
    mo.md(
        f"""
    **Focus stations:** loudest **{loudest}** ({insights['loudest_median']:.1f} dB),
    distinctive **{distinctive}** ({insights['distinctive_median']:.1f} dB),
    calmest **{calmest}** ({insights['calmest_median']:.1f} dB).

    City median night LAeq: **{insights['city_first']:.1f}** ({insights['year_first']}) →
    **{insights['city_last']:.1f}** ({insights['year_last']}).

    Viz params: y **45–75 dB**; 2–3 station lines + dashed city context; optional L10−L90 for focus IDs;
    **no** common-sounds guides. Blocker: no lat/lon until stations CSV.
    """
    )
    return insights, meta, recent_spread


@app.cell
def _(insights):
    insights
    return


if __name__ == "__main__":
    app.run()
