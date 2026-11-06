"""Export data and map overlays for the web atlas in docs/.

Writes
  docs/data/app_data.json      annual table, long-term rainfall, summary and map-layer metadata
  docs/data/*.csv, *.geojson   downloadable copies of the analysis outputs
  docs/overlays/*.png          map overlays: one pixel per grid cell, transparent outside the catchment

Overlay layers (per catchment, for the 2018-2024 mean and each year):
  surplus  rainfall (CHIRPS v2.0) minus actual ET (WaPOR v3), on the 5 km CHIRPS grid
  rain     rainfall, CHIRPS v2.0, 5 km
  et       actual evapotranspiration and interception, WaPOR v3, 300 m
Each layer uses one colour scale for all years and both catchments, so maps can be compared.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap
from PIL import Image
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from recharge.rasters import inside_mask, load_subset  # noqa: E402

DOCS = ROOT / "docs"
MAPS = ROOT / "outputs/maps"
RASTERS = ROOT / "data/processed/rasters"
YEARS = list(range(2018, 2025))
PERIODS = ["mean"] + [str(y) for y in YEARS]

LAYERS = {
    "surplus": {"label": "Rain left after evapotranspiration", "unit": "mm/year",
                "source": "CHIRPS v2.0 − WaPOR v3 · 5 km grid", "diverging": True,
                "stops": ["#b8302f", "#e34948", "#f0efec", "#2a78d6", "#184f95"],
                "low_label": "Evapotranspiration exceeds rain", "high_label": "Rain exceeds evapotranspiration"},
    "rain": {"label": "Rainfall", "unit": "mm/year", "source": "CHIRPS v2.0 · 5 km grid", "diverging": False,
             "stops": ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"],
             "low_label": "Less rain", "high_label": "More rain"},
    "et": {"label": "Evapotranspiration", "unit": "mm/year", "source": "WaPOR v3 · 300 m grid", "diverging": False,
           "stops": ["#fbe3d6", "#f4b08f", "#eb6834", "#b84a1c", "#7a2e0e"],
           "low_label": "Less water returned to the air", "high_label": "More water returned to the air"},
}


def layer_path(layer: str, basin: str, period: str) -> Path:
    if layer == "surplus":
        return MAPS / (f"{basin}_surplus_mean_0p05.tif" if period == "mean" else f"{basin}_surplus_{period}.tif")
    if layer == "rain":
        return MAPS / f"{basin}_p_chirps2_mean_0p05.tif" if period == "mean" else RASTERS / "chirps_v2" / f"{basin}_{period}.tif"
    return MAPS / f"{basin}_et_mean_300m.tif" if period == "mean" else RASTERS / "wapor_aeti" / f"{basin}_{period}.tif"


def load_masked(path: Path, geom):
    sub = load_subset(path)
    data = np.where(inside_mask(geom, sub.data.shape, sub.transform), sub.data, np.nan)
    rows, cols = np.where(np.isfinite(data))
    r0, r1, c0, c1 = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1
    t = sub.transform
    west, north = t.c + c0 * t.a, t.f + r0 * t.e
    east, south = t.c + c1 * t.a, t.f + r1 * t.e
    return data[r0:r1, c0:c1], [[south, west], [north, east]]


def nice(v: float, step: float = 50.0, up: bool = True) -> float:
    return float(np.ceil(v / step) * step if up else np.floor(v / step) * step)


def main() -> None:
    feats = json.loads((ROOT / "data/processed/basins.geojson").read_text())["features"]
    basins = {f["properties"]["basin_id"]: shape(f["geometry"]) for f in feats}

    grids = {(l, b, p): load_masked(layer_path(l, b, p), g) for l in LAYERS for b, g in basins.items() for p in PERIODS}

    # One colour range per layer, shared by all years and both catchments
    for l, meta in LAYERS.items():
        vals = np.concatenate([grids[(l, b, p)][0][np.isfinite(grids[(l, b, p)][0])] for b in basins for p in PERIODS])
        if meta["diverging"]:
            s = nice(np.percentile(np.abs(vals), 99))
            meta["vmin"], meta["vmax"] = -s, s
        else:
            meta["vmin"], meta["vmax"] = nice(np.percentile(vals, 2), up=False), nice(np.percentile(vals, 98))

    out = DOCS / "overlays"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    images = {b: {l: {} for l in LAYERS} for b in basins}
    for (l, b, p), (data, bounds) in grids.items():
        meta = LAYERS[l]
        cmap = LinearSegmentedColormap.from_list(l, meta["stops"])
        norm = np.clip((data - meta["vmin"]) / (meta["vmax"] - meta["vmin"]), 0, 1)
        rgba = (cmap(np.nan_to_num(norm)) * 255).astype(np.uint8)
        rgba[..., 3] = np.where(np.isfinite(data), 255, 0)
        name = f"{b}_{l}_{p}.png"
        Image.fromarray(rgba, "RGBA").save(out / name, optimize=True)
        images[b][l][p] = {"file": f"overlays/{name}", "bounds": bounds,
                           "cell_deg": round(abs(load_subset(layer_path(l, b, p)).transform.a), 5)}

    (DOCS / "data").mkdir(parents=True, exist_ok=True)
    annual = pd.read_csv(ROOT / "outputs/annual_balance.csv")
    long_term = pd.read_csv(ROOT / "outputs/long_term_chirps.csv")
    summary = json.loads((ROOT / "outputs/summary.json").read_text())
    app = {
        "annual": json.loads(annual.to_json(orient="records")),
        "long_term": json.loads(long_term.to_json(orient="records")),
        "summary": summary,
        "layers": LAYERS,
        "images": images,
        "gauge": {"name": "Bétérou river gauge", "lat": 9.19867, "lon": 2.26794},
    }
    (DOCS / "data/app_data.json").write_text(json.dumps(app, ensure_ascii=False, separators=(",", ":")))
    for src in ["outputs/annual_balance.csv", "outputs/long_term_chirps.csv", "data/processed/basins.geojson"]:
        shutil.copy(ROOT / src, DOCS / "data" / Path(src).name)
    print("app data written;", {l: (m["vmin"], m["vmax"]) for l, m in LAYERS.items()}, f"{len(grids)} overlays")


if __name__ == "__main__":
    main()
