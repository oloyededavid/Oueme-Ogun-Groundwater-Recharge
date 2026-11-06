"""Export data for the web atlas in docs/.

Writes
  docs/data/app_data.json      annual table, long-term rainfall, summary and the map grid
  docs/data/*.csv, *.geojson   downloadable copies of the analysis outputs

Map grid: every 5 km CHIRPS v2.0 cell whose centre lies inside a catchment, for the 2018-2024 mean
and each year, with these layers:
  rain_<product>     rainfall for chirps2, chirps3 and tamsat (CHIRPS v3.0 and TAMSAT averaged onto the grid)
  et                 actual evapotranspiration and interception, WaPOR v3, averaged from 300 m onto the 5 km cells
  surplus_<product>  rain_<product> - et
The page draws each cell as a square, so nothing finer than the 5 km rainfall grid is implied.
One colour range per layer is shared by all years and both catchments.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from rasterio.warp import Resampling, reproject
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from recharge.rasters import inside_mask, load_subset  # noqa: E402

DOCS = ROOT / "docs"
RASTERS = ROOT / "data/processed/rasters"
YEARS = list(range(2018, 2025))

LAYERS = {
    "surplus": {"label": "Rain left after evapotranspiration", "short": "Rain left after ET", "unit": "mm/year",
                "source": "rainfall − WaPOR v3 evapotranspiration", "diverging": True,
                "stops": ["#7a2e0e", "#c0623a", "#efe9dd", "#5598e7", "#0d366b"],
                "low_label": "Plants used more than fell", "high_label": "Rain left over"},
    "rain": {"label": "Rainfall", "short": "Rainfall", "unit": "mm/year", "source": "satellite rainfall", "diverging": False,
             "stops": ["#d9e8fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"],
             "low_label": "Less rain", "high_label": "More rain"},
    "et": {"label": "Evapotranspiration", "short": "Evapotranspiration", "unit": "mm/year",
           "source": "WaPOR v3, averaged from 300 m onto the 5 km cells", "diverging": False,
           "stops": ["#dcf3e8", "#8fdcb9", "#1baf7a", "#0f7d56", "#06492f"],
           "low_label": "Less water back to the sky", "high_label": "More water back to the sky"},
}
PRODUCT_DIRS = {"chirps2": "chirps_v2", "chirps3": "chirps_v3", "tamsat": "tamsat_v3.1"}


def onto(src, dst):
    """Area-average a finer grid onto a coarser one."""
    out = np.full(dst.data.shape, np.nan, dtype="float32")
    reproject(src.data.astype("float32"), out, src_transform=src.transform, src_crs=src.crs,
              dst_transform=dst.transform, dst_crs=dst.crs, resampling=Resampling.average,
              src_nodata=np.nan, dst_nodata=np.nan)
    return out


def nice(v: float, step: float = 50.0, up: bool = True) -> float:
    return float(np.ceil(v / step) * step if up else np.floor(v / step) * step)


def basin_grid(basin: str, geom) -> dict:
    ref = load_subset(RASTERS / "chirps_v2" / f"{basin}_{YEARS[0]}.tif")
    inside = inside_mask(geom, ref.data.shape, ref.transform)
    rows, cols = np.where(inside)
    t = ref.transform
    cells = [[round(t.f + (r + 1) * t.e, 4), round(t.c + c * t.a, 4)] for r, c in zip(rows, cols)]  # [south, west]
    per_year = {"et": []}
    for k in PRODUCT_DIRS:
        per_year[f"rain_{k}"], per_year[f"surplus_{k}"] = [], []
    for y in YEARS:
        grid = load_subset(RASTERS / "chirps_v2" / f"{basin}_{y}.tif")
        assert grid.transform == ref.transform, "CHIRPS v2.0 clips must share one grid"
        et = onto(load_subset(RASTERS / "wapor_aeti" / f"{basin}_{y}.tif"), grid)[rows, cols]
        per_year["et"].append(et)
        for k, folder in PRODUCT_DIRS.items():
            src = load_subset(RASTERS / folder / f"{basin}_{y}.tif")
            rain = (src.data if (src.transform == grid.transform and src.data.shape == grid.data.shape) else onto(src, grid))[rows, cols]
            per_year[f"rain_{k}"].append(rain)
            per_year[f"surplus_{k}"].append(rain - et)
    values = {}
    for layer, arrs in per_year.items():
        stack = np.vstack(arrs)
        values[layer] = {"mean": stack.mean(axis=0)}
        values[layer].update({str(y): stack[i] for i, y in enumerate(YEARS)})
    return {"cell_deg": round(abs(t.a), 5), "cells": cells, "values": values}


def main() -> None:
    feats = json.loads((ROOT / "data/processed/basins.geojson").read_text())["features"]
    grids = {f["properties"]["basin_id"]: basin_grid(f["properties"]["basin_id"], shape(f["geometry"])) for f in feats}

    for layer, meta in LAYERS.items():
        keys = ["et"] if layer == "et" else [f"{layer}_{k}" for k in PRODUCT_DIRS]
        vals = np.concatenate([np.concatenate(list(g["values"][key].values())) for g in grids.values() for key in keys])
        vals = vals[np.isfinite(vals)]
        if meta["diverging"]:
            s = nice(np.percentile(np.abs(vals), 99))
            meta["vmin"], meta["vmax"] = -s, s
        else:
            meta["vmin"], meta["vmax"] = nice(np.percentile(vals, 2), up=False), nice(np.percentile(vals, 98))

    for g in grids.values():
        g["values"] = {l: {p: [None if not np.isfinite(v) else int(round(float(v))) for v in arr] for p, arr in d.items()}
                       for l, d in g["values"].items()}

    (DOCS / "data").mkdir(parents=True, exist_ok=True)
    app = {
        "annual": json.loads(pd.read_csv(ROOT / "outputs/annual_balance.csv").to_json(orient="records")),
        "long_term": json.loads(pd.read_csv(ROOT / "outputs/long_term_chirps.csv").to_json(orient="records")),
        "summary": json.loads((ROOT / "outputs/summary.json").read_text()),
        "layers": LAYERS,
        "grid": grids,
        "gauge": {"name": "Bétérou river gauge", "lat": 9.19867, "lon": 2.26794},
    }
    (DOCS / "data/app_data.json").write_text(json.dumps(app, ensure_ascii=False, separators=(",", ":")))
    for src in ["outputs/annual_balance.csv", "outputs/long_term_chirps.csv", "data/processed/basins.geojson"]:
        shutil.copy(ROOT / src, DOCS / "data" / Path(src).name)
    old = DOCS / "overlays"
    if old.exists():
        shutil.rmtree(old)
    print("app data written;", {l: (m["vmin"], m["vmax"]) for l, m in LAYERS.items()},
          {b: len(g["cells"]) for b, g in grids.items()}, "cells")


if __name__ == "__main__":
    main()
