"""Report figures, drawn only from outputs/ (produced by 03_analysis.py).

Colour roles (validated, light mode): rainfall products CHIRPS v2.0 = blue, CHIRPS v3.0 = orange,
TAMSAT v3.1 = aqua. ET is a single series in neutral ink. Catchments are identified by labels.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import geopandas as gpd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from matplotlib.colors import LinearSegmentedColormap, TwoSlopeNorm  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from recharge.download import NATURAL_EARTH_ADMIN0, ensure_unzipped  # noqa: E402
from recharge.rasters import load_subset  # noqa: E402

OUT = ROOT / "figures"
OUT.mkdir(exist_ok=True)

BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
INK, INK2, GRID, MUTED, FILL = "#0b0b0b", "#52514e", "#e6e5e1", "#c3c2b7", "#f5f4f1"
PROD = {"chirps2": ("CHIRPS v2.0", BLUE, "o"), "chirps3": ("CHIRPS v3.0", ORANGE, "D"), "tamsat": ("TAMSAT v3.1", AQUA, "s")}
BASIN_SHORT = {"upper_oueme": "Upper Ouémé (Benin)", "upper_ogun": "Upper Ogun (Nigeria)"}
BIDS = ["upper_oueme", "upper_ogun"]

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": MUTED, "axes.labelcolor": INK2,
    "xtick.color": INK2, "ytick.color": INK2, "axes.titlecolor": INK, "axes.titlesize": 10,
    "axes.titleweight": "bold", "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.6,
    "axes.axisbelow": True, "axes.spines.top": False, "axes.spines.right": False,
    "legend.frameon": False, "savefig.dpi": 200, "savefig.bbox": "tight", "figure.facecolor": "white",
})

df = pd.read_csv(ROOT / "outputs/annual_balance.csv")
lt = pd.read_csv(ROOT / "outputs/long_term_chirps.csv")
summary = json.loads((ROOT / "outputs/summary.json").read_text())
basins = gpd.read_file(ROOT / "data/processed/basins.geojson")


def fig_study_area():
    ne = gpd.read_file(ensure_unzipped(NATURAL_EARTH_ADMIN0, ROOT / "data/raw"))
    fig, ax = plt.subplots(figsize=(6.2, 6.0))
    ne.plot(ax=ax, facecolor=FILL, edgecolor=MUTED, linewidth=0.8)
    basins.plot(ax=ax, facecolor="#d9d7d0", edgecolor=INK, linewidth=1.2)
    for _, r in basins.iterrows():
        c = r.geometry.representative_point()
        name, country = BASIN_SHORT[r.basin_id].split(" (")
        ax.annotate(f"{name}\n({country}\n{r.geodesic_area_km2:,.0f} km²", (c.x, c.y), ha="center", va="center",
                    fontsize=8, color=INK)
    ax.plot(2.26794, 9.19867, marker="v", ms=8, color=INK)
    ax.annotate("Bétérou gauge", (2.26794, 9.19867), xytext=(2.4, 8.95), fontsize=8, color=INK2)
    # Country labels at fixed positions inside each country (checked against the borders)
    for name, (x, y) in {"BENIN": (2.05, 8.3), "NIGERIA": (4.45, 9.6), "TOGO": (0.95, 8.6)}.items():
        ax.text(x, y, name, fontsize=8, color=INK2, ha="center")
    ax.set_xlim(0.6, 4.9); ax.set_ylim(6.1, 10.9)
    ax.set_xlabel("Longitude (°E)"); ax.set_ylabel("Latitude (°N)")
    ax.set_title("Study catchments on crystalline basement (HydroBASINS level 9)")
    fig.savefig(OUT / "fig1_study_area.png"); plt.close(fig)


def fig_rainfall_context():
    fig, axes = plt.subplots(2, 1, figsize=(8.4, 6.0), sharex=True)
    for ax, b in zip(axes, BIDS):
        s = lt[lt.basin_id == b]
        lo, hi = summary["basins"][b]["baseline_terciles_chirps2_mm"]
        ax.bar(s.year, s.p_chirps2_mm, color=[BLUE if y >= 2018 else "#9ec5f4" for y in s.year], width=0.8,
               label="CHIRPS v2.0 (2018–2024 darker)")
        ax.plot(s.year, s.p_chirps3_mm, color=ORANGE, linewidth=2, marker="D", ms=3, label="CHIRPS v3.0")
        ax.axhline(hi, color=INK2, linestyle="--", linewidth=0.9, label=f"Upper tercile 1991–2020 (v2.0): {hi:,.0f} mm")
        ax.axhline(lo, color=INK2, linestyle=":", linewidth=1.1, label=f"Lower tercile 1991–2020 (v2.0): {lo:,.0f} mm")
        top = max(s.p_chirps2_mm.max(), s.p_chirps3_mm.max()) * 1.32
        for _, r in df[df.basin_id == b].iterrows():
            ax.text(r.year, top * 0.985, r.rain_class_chirps2, rotation=90, ha="center", va="top", fontsize=7, color=INK)
        ax.set_ylabel("Rainfall (mm/year)")
        ax.set_title(f"{BASIN_SHORT[b]}: annual rainfall 1981–2024 (top labels: 2018–2024 class, v2.0)")
        ax.set_ylim(0, top)
        ax.legend(loc="upper left", fontsize=7, ncol=2)
    axes[-1].set_xlabel("Year")
    fig.tight_layout(); fig.savefig(OUT / "fig2_rainfall_context.png"); plt.close(fig)


def fig_annual_balance():
    fig, axes = plt.subplots(2, 2, figsize=(10, 6.4), sharey="row", gridspec_kw={"height_ratios": [1.3, 1]})
    w = 0.27
    for j, b in enumerate(BIDS):
        s = df[df.basin_id == b]
        x = np.arange(len(s))
        for i, (k, (lab, col, _)) in enumerate(PROD.items()):
            axes[0, j].bar(x + (i - 1) * w, s[f"p_{k}_mm"], w * 0.92, color=col, label=lab)
        axes[0, j].set_title(f"{BASIN_SHORT[b]}: rainfall by product")
        axes[0, j].set_xticks(x, s.year.astype(int))
        axes[1, j].bar(x, s.et_wapor_mm, 0.5, color=INK2)
        axes[1, j].set_title(f"{BASIN_SHORT[b]}: WaPOR v3 evapotranspiration")
        axes[1, j].set_xticks(x, s.year.astype(int))
    axes[0, 0].set_ylabel("mm/year"); axes[1, 0].set_ylabel("mm/year")
    h, l = axes[0, 0].get_legend_handles_labels()
    fig.tight_layout(rect=(0, 0, 1, 0.95))
    fig.legend(h, l, loc="upper center", ncol=3, fontsize=8, bbox_to_anchor=(0.5, 1.0))
    fig.savefig(OUT / "fig3_annual_balance.png"); plt.close(fig)


def diverging_cmap():
    return LinearSegmentedColormap.from_list("rb", ["#b8302f", "#e34948", "#f0efec", BLUE, "#184f95"])


def fig_maps():
    fig, axes = plt.subplots(2, 2, figsize=(9.5, 8.2))
    s_all = [load_subset(ROOT / f"outputs/maps/{b}_surplus_mean_0p05.tif").data for b in BIDS]
    smax = float(np.nanpercentile(np.abs(np.concatenate([a[np.isfinite(a)] for a in s_all])), 99))
    e_all = np.concatenate([a[np.isfinite(a)] for a in
                            [load_subset(ROOT / f"outputs/maps/{b}_et_mean_300m.tif").data for b in BIDS]])
    emin, emax = np.nanpercentile(e_all, [1, 99])  # open water (>2,000 mm) would otherwise flatten the scale
    for j, b in enumerate(BIDS):
        g = basins[basins.basin_id == b]
        et = load_subset(ROOT / f"outputs/maps/{b}_et_mean_300m.tif")
        sp = load_subset(ROOT / f"outputs/maps/{b}_surplus_mean_0p05.tif")
        for i, (sub, cmap, norm, lab) in enumerate([
            (et, "Greys", plt.Normalize(emin, emax), "WaPOR ET, 2018–2024 mean (mm/year), 300 m"),
            (sp, diverging_cmap(), TwoSlopeNorm(0, -smax, smax), "CHIRPS v2.0 − ET, 2018–2024 mean (mm/year), 5 km"),
        ]):
            ax = axes[i, j]
            t = sub.transform
            ext = [t.c, t.c + t.a * sub.data.shape[1], t.f + t.e * sub.data.shape[0], t.f]
            im = ax.imshow(sub.data, extent=ext, cmap=cmap, norm=norm, interpolation="nearest")
            g.boundary.plot(ax=ax, color=INK, linewidth=0.8)
            ax.set_title(BASIN_SHORT[b], fontsize=9); ax.set_aspect("equal"); ax.grid(False)
            ax.set_xlabel("Longitude (°E)"); ax.set_ylabel("Latitude (°N)")
            cb = fig.colorbar(im, ax=ax, shrink=0.8, extend="both")
            cb.set_label(lab, fontsize=7.5, color=INK2)
    fig.suptitle("Evapotranspiration (top) and rainfall minus evapotranspiration (bottom)",
                 fontweight="bold", fontsize=10, color=INK)
    fig.tight_layout(); fig.savefig(OUT / "fig4_maps.png"); plt.close(fig)


def fig_closure():
    r_lo, r_hi = summary["beterou_observed_runoff"]["ratio_range"]
    fig, axes = plt.subplots(1, 2, figsize=(10.5, 4.4), sharey=True)
    for ax, b in zip(axes, BIDS):
        s = df[df.basin_id == b]
        x = s.year.values
        pm = s[["p_chirps2_mm", "p_chirps3_mm", "p_tamsat_mm"]].mean(axis=1).values
        oue = b == "upper_oueme"
        lab = ("River flow expected from the observed Bétérou runoff ratios" if oue
               else "Same ratios applied to the Upper Ogun (assumption: no flow data)")
        ax.fill_between(x, r_lo * pm, r_hi * pm, color=MUTED, alpha=0.7, step="mid", linewidth=0)
        ax.step(x, (r_lo + r_hi) / 2 * pm, where="mid", color=INK2, linewidth=1.5, linestyle="-" if oue else "--",
                label=lab)
        for i, (k, (pl, col, mk)) in enumerate(PROD.items()):
            yerr = 0.10 * s.et_wapor_mm.values if k == "chirps2" else None
            ax.errorbar(x + (i - 1) * 0.18, s[f"surplus_{k}_mm"], yerr=yerr, fmt=mk, ms=6, color=col, capsize=3,
                        label=f"Rainfall − ET, {pl}" + (" (bars: ET ±10%)" if yerr is not None else ""))
        ax.axhline(0, color=INK2, linewidth=0.8)
        ax.set_title(BASIN_SHORT[b]); ax.set_xticks(x)
    axes[0].set_ylabel("mm/year")
    h, l = axes[0].get_legend_handles_labels()
    h2, l2 = axes[1].get_legend_handles_labels()
    fig.legend(h + [h2[0]], l + [l2[0]], loc="lower center", ncol=3, fontsize=7.5, bbox_to_anchor=(0.5, -0.1))
    fig.suptitle("Rainfall − ET versus river flow expected from the observed Bétérou runoff ratios",
                 fontweight="bold", fontsize=10, color=INK)
    fig.tight_layout(); fig.savefig(OUT / "fig5_closure.png"); plt.close(fig)


def fig_residual_vs_recharge():
    """Upper Ouémé: the closure residual and published recharge, both as % of annual rainfall."""
    c = summary["closure_upper_oueme_2018_2024"]
    refs = summary["published_recharge_fraction"]
    fig, ax = plt.subplots(figsize=(8.2, 2.9))
    rows = ["Closure residual, this study\n(2018–2024 mean, three rainfall products)",
            "Recharge, Kamagaté et al. (2007)\nDonga sub-basin, 2 years of water-table data",
            "Recharge, Kotchoni et al. (2019)\nweathered crystalline aquifer, 19–25-year records"]
    lo, hi = refs["kamagate2007"]
    ax.barh(1, 100 * (hi - lo), left=100 * lo, height=0.32, color=MUTED, label="Published range")
    ax.plot(100 * refs["kotchoni2019"][0], 0, marker="|", ms=16, mew=3, color=INK2, linestyle="none",
            label="Published value")
    for k, (pl, col, mk) in PROD.items():
        v = c[k]["residual_pct_of_rainfall"]
        ax.plot(v, 2, marker=mk, ms=8, color=col, linestyle="none", label=f"Residual, {pl}: {v:.1f}%")
    ax.set_yticks([2, 1, 0]); ax.set_yticklabels(rows, fontsize=8); ax.set_ylim(-0.6, 2.6)
    ax.set_xlim(0, 26); ax.set_xlabel("% of annual rainfall"); ax.grid(axis="y", visible=False)
    ax.legend(loc="upper center", bbox_to_anchor=(0.32, -0.3), ncol=3, fontsize=7.5)
    ax.set_title("Upper Ouémé: the closure error is as large as published recharge", loc="left")
    fig.tight_layout(); fig.savefig(OUT / "fig6_residual_vs_recharge.png"); plt.close(fig)


if __name__ == "__main__":
    fig_study_area(); fig_rainfall_context(); fig_annual_balance(); fig_maps(); fig_closure(); fig_residual_vs_recharge()
    print("figures written:", sorted(p.name for p in OUT.glob("*.png")))
