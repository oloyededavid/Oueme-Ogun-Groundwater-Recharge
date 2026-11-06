"""Consistency checks on the committed analysis outputs and the website data.

These do not test whether the method is right; they test that the published numbers are internally
consistent, use one catchment area, and are the same in every place they are shown.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from recharge.balance import runoff_depth_mm

ROOT = Path(__file__).resolve().parents[1]
SUMMARY = json.loads((ROOT / "outputs/summary.json").read_text())
ANNUAL = pd.read_csv(ROOT / "outputs/annual_balance.csv")
BASINS = {f["properties"]["basin_id"]: f["properties"]
          for f in json.loads((ROOT / "data/processed/basins.geojson").read_text())["features"]}
PRODUCTS = ("chirps2", "chirps3", "tamsat")


def test_seven_complete_years_per_catchment():
    for b in BASINS:
        years = ANNUAL[ANNUAL.basin_id == b].year.tolist()
        assert years == list(range(2018, 2025))
    assert SUMMARY["qa"]["min_valid_fraction"] >= 0.95


def test_one_area_for_every_term():
    # Runoff depth is converted over the same polygon whose pixels give rainfall and ET.
    area = SUMMARY["beterou_observed_runoff"]["area_km2"]
    assert area == pytest.approx(BASINS["upper_oueme"]["geodesic_area_km2"])
    assert SUMMARY["basins"]["upper_oueme"]["area_km2"] == pytest.approx(area)
    for per, v in SUMMARY["beterou_observed_runoff"]["periods"].items():
        q = {"1971-1987": 47.5, "1988-2010": 54.5}[per]
        assert v["runoff_mm"] == pytest.approx(float(runoff_depth_mm(q, area)))


def test_balance_terms_recompute_from_annual_table():
    r = SUMMARY["beterou_observed_runoff"]["ratio_range"][1]
    o = ANNUAL[ANNUAL.basin_id == "upper_oueme"]
    for k in PRODUCTS:
        p, et = o[f"p_{k}_mm"], o.et_wapor_mm
        np.testing.assert_allclose(o[f"surplus_{k}_mm"], p - et, atol=0.02)
        np.testing.assert_allclose(o[f"q_expected_{k}_mm"], r * p, atol=0.02)
        np.testing.assert_allclose(o[f"closure_residual_{k}_mm"], p - et - r * p, atol=0.03)
        c = SUMMARY["closure_upper_oueme_2018_2024"][k]
        assert c["mean_closure_residual_mm"] == pytest.approx(o[f"closure_residual_{k}_mm"].mean(), abs=0.01)
        assert c["cumulative_residual_mm"] == pytest.approx(o[f"closure_residual_{k}_mm"].sum(), abs=0.1)


def test_runoff_ratio_sensitivity_is_linear_and_closes_where_stated():
    s = SUMMARY["runoff_ratio_sensitivity"]
    for k in PRODUCTS:
        needed = SUMMARY["closure_upper_oueme_2018_2024"][k]["runoff_ratio_needed"]
        res = np.interp(needed, s["ratio"], s["mean_residual_mm"][k])
        assert abs(res) < 0.5


def test_storage_diagnostic_matches_its_formula():
    for k in PRODUCTS:
        c = SUMMARY["closure_upper_oueme_2018_2024"][k]
        lo, hi = c["water_table_rise_if_stored_m"]
        sy_min, sy_max = c["sy_range"]
        assert lo == pytest.approx(c["cumulative_residual_mm"] / 1000 / sy_max)
        assert hi == pytest.approx(c["cumulative_residual_mm"] / 1000 / sy_min)


def test_website_data_matches_outputs():
    app = json.loads((ROOT / "docs/data/app_data.json").read_text())
    assert app["summary"] == SUMMARY
    web = pd.DataFrame(app["annual"])
    pd.testing.assert_frame_equal(web.reset_index(drop=True), ANNUAL.reset_index(drop=True), check_dtype=False)
