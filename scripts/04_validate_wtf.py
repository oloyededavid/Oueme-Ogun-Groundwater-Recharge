"""Validation: well-based recharge and storage change, compared with the satellite water balance.

Needs AMMA-CATCH groundwater-level data for the Upper Ouémé (free registration at
https://bd.amma-catch.org). Put one or more CSV files in data/raw/amma_catch/ with columns:

    well_id, date (YYYY-MM-DD), depth_to_water_m   (metres below ground, positive down)

Specific yield range: 0.2%-1.5% by default (SY_RANGE_CRYSTALLINE in src/recharge/wtf.py, from
Lachassagne, Dewandel & Wyns, 2021, Hydrogeology Journal 29, 2561-2594). Replace it with site values
(e.g. from magnetic resonance soundings in Benin, Vouillamoz et al., 2014) if available.

Two comparisons:
  1. Gross recharge per year (water-table fluctuation method) against the 4%-of-rainfall level and the
     satellite surplus.
  2. Storage change per year (trend of annual mean head x specific yield) against the closure residual.
     If the residual were stored groundwater, the two would be similar.

Writes outputs/validation_wtf.csv and outputs/validation_storage.csv and prints both comparisons.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from recharge.wtf import (SY_RANGE_CRYSTALLINE, annual_rises, head_trend_m_per_year, heads_from_depth,  # noqa: E402
                          wtf_recharge_range)

DATA = ROOT / "data/raw/amma_catch"
SY_MIN, SY_MAX = SY_RANGE_CRYSTALLINE
YEARS = (2018, 2024)


def main() -> int:
    files = sorted(DATA.glob("*.csv")) if DATA.exists() else []
    if not files:
        print("No AMMA-CATCH well files found in data/raw/amma_catch/.\n"
              "Validation is pending: see data/README.md for how to obtain the data.")
        return 1
    wells = pd.concat([pd.read_csv(f, parse_dates=["date"]) for f in files], ignore_index=True)
    wells = wells[wells.date.dt.year.between(*YEARS)]
    rows, trends = [], []
    for well_id, g in wells.groupby("well_id"):
        head = heads_from_depth(g.set_index("date")["depth_to_water_m"])
        rng = wtf_recharge_range(annual_rises(head), SY_MIN, SY_MAX)
        rng["well_id"] = well_id
        rows.append(rng.rename_axis("year").reset_index())
        trend = head_trend_m_per_year(head)
        trends.append({"well_id": well_id, "head_trend_m_per_year": trend,
                       "storage_change_low_mm_per_year": trend * SY_MIN * 1000,
                       "storage_change_high_mm_per_year": trend * SY_MAX * 1000})
    wtf = pd.concat(rows, ignore_index=True)
    store = pd.DataFrame(trends)
    wtf.to_csv(ROOT / "outputs/validation_wtf.csv", index=False, float_format="%.1f")
    store.to_csv(ROOT / "outputs/validation_storage.csv", index=False, float_format="%.3f")

    bal = pd.read_csv(ROOT / "outputs/annual_balance.csv")
    bal = bal[bal.basin_id == "upper_oueme"].set_index("year")
    cols = ["kotchoni_4pct_low_mm", "kotchoni_4pct_high_mm"] + [c for c in bal.columns if c.startswith(("surplus_chirps", "surplus_tamsat", "closure_residual_"))]
    per_year = wtf.groupby("year")[["recharge_low_mm", "recharge_high_mm"]].median()
    print("1. Median well recharge (WTF) vs satellite balance, mm/year")
    print(per_year.join(bal[cols]).round(1).to_string())
    print("\n2. Storage change from water-level trends (median over wells), mm/year")
    print(store[["storage_change_low_mm_per_year", "storage_change_high_mm_per_year"]].median().round(1).to_string())
    print("Mean closure residual, mm/year:", bal[[c for c in cols if c.startswith("closure_residual_")]].mean().round(1).to_dict())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
