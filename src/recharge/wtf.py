"""Water-table fluctuation (WTF) recharge from well hydrographs (Healy & Cook, 2002).

Recharge in a year = specific yield (Sy) x water-table rise in that year.
Here the rise is the wet-season peak head minus the lowest head earlier in the same year.
This ignores drainage that continues during the rise, so it is a LOWER estimate of gross recharge
for a given Sy; Sy itself is the largest source of uncertainty and is given as a range.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Specific yield of weathered crystalline aquifers, decreasing with depth from about 1.5% to 0.2%
# (Lachassagne, Dewandel & Wyns, 2021, Hydrogeology Journal 29, 2561-2594, doi:10.1007/s10040-021-02339-7).
SY_RANGE_CRYSTALLINE = (0.002, 0.015)


def heads_from_depth(depth_to_water_m: pd.Series) -> pd.Series:
    """Convert depth to water below ground (m, positive down) to relative head (m, positive up)."""
    return -depth_to_water_m.astype(float)


def annual_rises(head_m: pd.Series, min_obs_per_year: int = 12) -> pd.Series:
    """Water-table rise (m) per calendar year: peak head minus the minimum head before the peak.

    `head_m` must have a DatetimeIndex. Years with fewer than `min_obs_per_year`
    observations are returned as NaN.
    """
    if not isinstance(head_m.index, pd.DatetimeIndex):
        raise TypeError("head_m needs a DatetimeIndex.")
    s = head_m.dropna().sort_index()
    out = {}
    for year, grp in s.groupby(s.index.year):
        if len(grp) < min_obs_per_year:
            out[year] = np.nan
            continue
        t_peak = grp.idxmax()
        before = grp.loc[:t_peak]
        out[year] = float(grp.max() - before.min())
    return pd.Series(out, name="rise_m", dtype=float)


def wtf_recharge_mm(rise_m, sy):
    """Recharge (mm/year) = Sy x rise (m) x 1000."""
    return np.asarray(rise_m, dtype=float) * float(sy) * 1000.0


def head_change_for_storage_m(storage_mm, sy):
    """Water-table change (m) needed to hold `storage_mm` of water in an aquifer of specific yield `sy`."""
    return np.asarray(storage_mm, dtype=float) / (float(sy) * 1000.0)


def head_trend_m_per_year(head_m: pd.Series, min_obs_per_year: int = 12) -> float:
    """Least-squares trend (m/year) of the annual mean head, using years with enough readings.

    Times specific yield, this is the mean yearly change in groundwater storage: the groundwater
    part of a water-balance closure residual. Needs at least three usable years.
    """
    if not isinstance(head_m.index, pd.DatetimeIndex):
        raise TypeError("head_m needs a DatetimeIndex.")
    s = head_m.dropna()
    g = s.groupby(s.index.year)
    annual = g.mean()[g.size() >= min_obs_per_year]
    if len(annual) < 3:
        return float("nan")
    return float(np.polyfit(annual.index.values.astype(float), annual.values, 1)[0])


def wtf_recharge_range(rises_m: pd.Series, sy_min: float, sy_max: float) -> pd.DataFrame:
    """Recharge for the lower and upper specific yield of a published range."""
    if not 0 < sy_min <= sy_max < 1:
        raise ValueError("Specific yield must satisfy 0 < sy_min <= sy_max < 1.")
    return pd.DataFrame({
        "rise_m": rises_m,
        "recharge_low_mm": wtf_recharge_mm(rises_m, sy_min),
        "recharge_high_mm": wtf_recharge_mm(rises_m, sy_max),
    })
