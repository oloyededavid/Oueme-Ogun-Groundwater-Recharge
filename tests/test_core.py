"""Unit tests with hand-calculated expected values. All inputs here are synthetic test cases, not data."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from rasterio.transform import from_origin
from shapely.geometry import box

from recharge.balance import closure_residual, et_bias_effect, net_recharge_bounds, runoff_depth_mm, surplus
from recharge.basins import upstream_ids
from recharge.climate import classify, standardized_anomaly, tercile_thresholds
from recharge.rasters import Subset, catchment_mean, pixel_area_weights
from recharge.wtf import (annual_rises, head_change_for_storage_m, head_trend_m_per_year, heads_from_depth,
                          wtf_recharge_mm, wtf_recharge_range)


# --- basins -------------------------------------------------------------------------------
def test_upstream_tracing_small_network():
    # 1 <- 2 <- 4, 1 <- 3, and 5 drains elsewhere (6)
    next_down = {1: 0, 2: 1, 3: 1, 4: 2, 5: 6, 6: 0}
    assert upstream_ids(1, next_down) == {1, 2, 3, 4}
    assert upstream_ids(2, next_down) == {2, 4}
    with pytest.raises(KeyError):
        upstream_ids(99, next_down)


# --- rasters ------------------------------------------------------------------------------
def test_catchment_mean_uniform_and_weighted():
    tr = from_origin(0.0, 2.0, 1.0, 1.0)  # 2x2 grid of 1-degree cells, latitudes 1.5 and 0.5
    data = np.array([[10.0, 10.0], [20.0, 20.0]])
    mean, frac = catchment_mean(Subset(data, tr, "EPSG:4326"), box(0, 0, 2, 2))
    w_top, w_bot = np.cos(np.deg2rad(1.5)), np.cos(np.deg2rad(0.5))
    assert frac == pytest.approx(1.0)
    assert mean == pytest.approx((10 * w_top + 20 * w_bot) / (w_top + w_bot))


def test_catchment_mean_rejects_mostly_missing():
    tr = from_origin(0.0, 2.0, 1.0, 1.0)
    data = np.array([[np.nan, np.nan], [np.nan, 5.0]])
    mean, frac = catchment_mean(Subset(data, tr, "EPSG:4326"), box(0, 0, 2, 2))
    assert np.isnan(mean) and frac < 0.5


def test_save_read_roundtrip_and_valid_min(tmp_path):
    from recharge.rasters import load_subset, read_subset, save_subset

    tr = from_origin(2.0, 10.0, 0.5, 0.5)  # 4x4 grid covering lon 2-4, lat 8-10
    data = np.array([[1.0, 2.0, 3.0, 4.0], [5.0, -9999.0, 7.0, 8.0], [9.0, 10.0, 11.0, 12.0], [13.0, 14.0, 15.0, 16.0]])
    save_subset(Subset(data, tr, "EPSG:4326"), tmp_path / "t.tif")
    back = load_subset(tmp_path / "t.tif")
    assert np.allclose(back.data, data)
    sub = read_subset(str(tmp_path / "t.tif"), (2.0, 8.0, 4.0, 10.0), pad_deg=0.0, valid_min=0.0)
    assert sub.data.shape == (4, 4) and np.isnan(sub.data[1, 1]) and sub.data[0, 0] == 1.0


def test_pixel_weights_shape():
    w = pixel_area_weights((3, 4), from_origin(0, 60, 1, 1))
    assert w.shape == (3, 4) and w[0, 0] < w[-1, 0]  # cells nearer the equator are larger


# --- balance ------------------------------------------------------------------------------
def test_runoff_depth_conversion():
    # 54.5 m3/s over 10,072 km2 -> 170.8 mm/yr (published Bétérou mean flow, 1988-2010)
    assert runoff_depth_mm(54.5, 10072) == pytest.approx(170.76, abs=0.05)
    # 1 m3/s over 31.5576 km2 = 1000 mm/yr exactly
    assert runoff_depth_mm(1.0, 31.5576) == pytest.approx(1000.0)


def test_surplus_closure_and_bounds():
    p, et, q = 1200.0, 900.0, 170.0
    assert surplus(p, et) == pytest.approx(300.0)
    assert closure_residual(p, et, q) == pytest.approx(130.0)
    lo, hi = net_recharge_bounds(p, et, q)
    assert (lo, hi) == (pytest.approx(130.0), pytest.approx(300.0))
    assert et_bias_effect(900.0, 0.1) == pytest.approx(-90.0)


# --- climate ------------------------------------------------------------------------------
def test_terciles_and_classification():
    base = np.arange(1, 31, dtype=float)  # 1..30
    lo, hi = tercile_thresholds(base)
    assert lo == pytest.approx(np.percentile(base, 100 / 3))
    assert classify(5, (lo, hi)) == "dry"
    assert classify(15, (lo, hi)) == "normal"
    assert classify(28, (lo, hi)) == "wet"
    assert classify(np.nan, (lo, hi)) == "missing"
    assert standardized_anomaly(base.mean(), base) == pytest.approx(0.0)
    with pytest.raises(ValueError):
        tercile_thresholds([1, 2, 3])


# --- water-table fluctuation -----------------------------------------------------------------
def test_wtf_annual_rise_and_recharge():
    # Synthetic hydrograph: falls 2 m to May, rises 3 m to September, then falls again.
    idx = pd.date_range("2020-01-01", "2020-12-31", freq="7D")
    doy = idx.dayofyear.values
    depth = np.where(doy <= 140, 10 + 2 * doy / 140,                 # 10 m -> 12 m below ground
             np.where(doy <= 260, 12 - 3 * (doy - 140) / 120,       # 12 m -> 9 m
                      9 + 1.5 * (doy - 260) / 105))                 # 9 m -> ~10.5 m
    head = heads_from_depth(pd.Series(depth, index=idx))
    rise = annual_rises(head)
    assert rise.loc[2020] == pytest.approx(3.0, abs=0.06)  # weekly sampling misses the exact extremes
    assert wtf_recharge_mm(3.0, 0.02) == pytest.approx(60.0)
    rng = wtf_recharge_range(rise, 0.01, 0.03)
    assert rng.loc[2020, "recharge_low_mm"] == pytest.approx(rise.loc[2020] * 10.0)
    with pytest.raises(ValueError):
        wtf_recharge_range(rise, 0.05, 0.01)


def test_storage_and_head_trend():
    # 100 mm of water in an aquifer with 1% specific yield needs a 10 m water-table rise
    assert head_change_for_storage_m(100.0, 0.01) == pytest.approx(10.0)
    # Synthetic weekly heads: seasonal cycle of +/-2 m on a rising trend of 0.5 m/year, 2018-2024
    idx = pd.date_range("2018-01-01", "2024-12-31", freq="7D")
    t = idx.year + (idx.dayofyear - 1) / 365.25
    head = pd.Series(0.5 * (t - 2018) + 2 * np.sin(2 * np.pi * t), index=idx)
    assert head_trend_m_per_year(head) == pytest.approx(0.5, abs=0.02)
    assert np.isnan(head_trend_m_per_year(head["2018"]))  # one year is not enough for a trend
