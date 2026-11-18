import marimo

__generated_with = "0.25.2"
app = marimo.App(width="full")


@app.cell
def _():
    import marimo as mo

    mo.md(
        r"""
    ### Hong Kong — 2020 traffic L₁₀ (1 h @ 4 m)

    Locked: territory **L₁₀** raster; **>70 dB** mask / share among valid cells.  
    Downsample for analysis. No common-sounds reference lines. L₁₀ ≠ Lden.
    """
    )
    return (mo,)


@app.cell
def _():
    from pathlib import Path

    import matplotlib.pyplot as plt
    import numpy as np
    import tifffile

    ROOT = Path(__file__).resolve().parents[2]
    TIF = ROOT / "data" / "raw" / "hong_kong" / "L10" / "4M_CombinedHK_L10.tif"
    TFW = ROOT / "data" / "raw" / "hong_kong" / "L10" / "4M_CombinedHK_L10.tfw"
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
    return OUT, ROOT, TFW, TIF, np, plt, tifffile


@app.cell
def _(OUT, TFW, TIF, mo, np, tifffile):
    # Full read then stride-downsample (float64 DEFLATE ~18M cells)
    arr = tifffile.imread(TIF)
    step = 8  # ~10m → ~80m analysis grid
    ds = arr[::step, ::step]
    # Valid: finite and in plausible L10 traffic range (exclude deep negatives / nodata edges)
    valid = np.isfinite(ds) & (ds >= 30) & (ds <= 100)
    vals = ds[valid]
    pct_gt70 = float((vals > 70).mean() * 100) if vals.size else None
    pct_gt75 = float((vals > 75).mean() * 100) if vals.size else None
    pct_gt80 = float((vals > 80).mean() * 100) if vals.size else None
    stats = {
        "shape_full": list(arr.shape),
        "shape_downsampled": list(ds.shape),
        "downsample_step": step,
        "n_valid": int(vals.size),
        "min": float(vals.min()) if vals.size else None,
        "p50": float(np.median(vals)) if vals.size else None,
        "p90": float(np.percentile(vals, 90)) if vals.size else None,
        "max": float(vals.max()) if vals.size else None,
        "pct_cells_gt70": pct_gt70,
        "pct_cells_gt75": pct_gt75,
        "pct_cells_gt80": pct_gt80,
        "tfw": TFW.read_text().strip().splitlines() if TFW.exists() else None,
    }
    # Save compact preview array (float32) + mask
    preview = np.where(valid, ds, np.nan).astype(np.float32)
    mask70 = np.where(valid & (ds > 70), 1, 0).astype(np.uint8)
    np.savez_compressed(
        OUT / "hong_kong_l10_preview.npz",
        l10=preview,
        mask_gt70=mask70,
        step=np.array([step]),
        stats=np.array([stats["pct_cells_gt70"] or -1]),
    )
    mo.md(
        f"Full **{arr.shape}** → step-{step} **{ds.shape}** · valid cells **{stats['n_valid']:,}** · "
        f"**{stats['pct_cells_gt70']:.1f}%** >70 dB (among valid)"
    )
    return arr, ds, mask70, pct_gt70, pct_gt75, pct_gt80, preview, stats, step, valid, vals


@app.cell
def _(ds, mask70, mo, np, plt, preview, stats, valid):
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.8), constrained_layout=True)
    ax = axes[0]
    im = ax.imshow(preview, cmap="magma", vmin=50, vmax=85, interpolation="nearest")
    ax.set_title("HK 2020 L₁₀ (downsampled)")
    ax.set_xticks([])
    ax.set_yticks([])
    fig.colorbar(im, ax=ax, fraction=0.046, label="L₁₀ dB")

    ax2 = axes[1]
    ax2.imshow(np.ma.masked_where(~valid, ds), cmap="gray", vmin=50, vmax=85, alpha=0.35)
    ax2.imshow(np.ma.masked_where(mask70 == 0, mask70), cmap="autumn", alpha=0.9, interpolation="nearest")
    ax2.set_title(f">70 dB mask · {stats['pct_cells_gt70']:.1f}% of valid")
    ax2.set_xticks([])
    ax2.set_yticks([])
    mo.mpl.interactive(fig)
    return ax, ax2, fig, im


@app.cell
def _(mo, stats):
    # re-import np for masked imshow cell dependency hygiene
    insights = stats
    mo.md(
        f"""
    **L₁₀** median **{stats['p50']:.1f}** dB · p90 **{stats['p90']:.1f}** · max **{stats['max']:.1f}**.  
    Share of valid cells **>70**: **{stats['pct_cells_gt70']:.1f}%** (also >75 {stats['pct_cells_gt75']:.1f}%, >80 {stats['pct_cells_gt80']:.1f}%).

    Viz params: heatmap vmin/vmax **50–85**; >70 mask overlay; downsample step 8 for scrolly preview; CRS = HK projected grid (reproject for web).  
    **No** common-sounds lines. Caveat: L₁₀ ≠ Lden; strategic 2020 map; no district population tables in download.
    """
    )
    return (insights,)


@app.cell
def _(insights):
    insights
    return


if __name__ == "__main__":
    app.run()
