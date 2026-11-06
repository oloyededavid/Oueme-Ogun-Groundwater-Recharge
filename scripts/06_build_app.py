"""Export data and map images for the static one-page app in docs/."""

from __future__ import annotations

import json
import shutil
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
from recharge.rasters import load_subset  # noqa: E402

DOCS = ROOT / "docs"
YEARS = list(range(2018, 2025))
BIDS = ["upper_oueme", "upper_ogun"]
CMAP = LinearSegmentedColormap.from_list("rb", ["#b8302f", "#e34948", "#f0efec", "#2a78d6", "#184f95"])


def main() -> None:
    (DOCS / "data").mkdir(parents=True, exist_ok=True)
    (DOCS / "maps").mkdir(exist_ok=True)
    basins = gpd.read_file(ROOT / "data/processed/basins.geojson")

    # One colour scale for every year and both catchments, symmetric around zero
    grids = {(b, y): load_subset(ROOT / f"outputs/maps/{b}_surplus_{y}.tif") for b in BIDS for y in YEARS}
    grids.update({(b, "mean"): load_subset(ROOT / f"outputs/maps/{b}_surplus_mean_0p05.tif") for b in BIDS})
    vmax = float(np.nanpercentile(np.abs(np.concatenate([g.data[np.isfinite(g.data)] for g in grids.values()])), 99))
    vmax = float(np.ceil(vmax / 50) * 50)

    for (b, y), sub in grids.items():
        t = sub.transform
        ext = [t.c, t.c + t.a * sub.data.shape[1], t.f + t.e * sub.data.shape[0], t.f]
        fig, ax = plt.subplots(figsize=(4.2, 4.2))
        im = ax.imshow(sub.data, extent=ext, cmap=CMAP, norm=TwoSlopeNorm(0, -vmax, vmax), interpolation="nearest")
        basins[basins.basin_id == b].boundary.plot(ax=ax, color="#0b0b0b", linewidth=0.8)
        ax.set_axis_off()
        cb = fig.colorbar(im, ax=ax, orientation="horizontal", fraction=0.05, pad=0.02)
        cb.set_label("Rainfall − ET (mm/year), 0.05° grid", fontsize=8)
        cb.ax.tick_params(labelsize=7)
        fig.savefig(DOCS / "maps" / f"{b}_surplus_{y}.png", dpi=110, bbox_inches="tight", transparent=True)
        plt.close(fig)

    annual = pd.read_csv(ROOT / "outputs/annual_balance.csv")
    lt = pd.read_csv(ROOT / "outputs/long_term_chirps.csv")
    summary = json.loads((ROOT / "outputs/summary.json").read_text())
    payload = {
        "annual": json.loads(annual.to_json(orient="records")),
        "long_term": json.loads(lt.to_json(orient="records")),
        "summary": summary,
        "map_scale_mm": vmax,
    }
    (DOCS / "data/app_data.json").write_text(json.dumps(payload, ensure_ascii=False))
    shutil.copy(ROOT / "outputs/annual_balance.csv", DOCS / "data/annual_balance.csv")
    shutil.copy(ROOT / "outputs/long_term_chirps.csv", DOCS / "data/long_term_chirps.csv")
    shutil.copy(ROOT / "data/processed/basins.geojson", DOCS / "data/basins.geojson")
    print("app data written; map colour scale ±", vmax, "mm/year")


if __name__ == "__main__":
    main()
