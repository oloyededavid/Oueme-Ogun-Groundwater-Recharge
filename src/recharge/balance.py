"""Annual catchment water balance.

Conceptual model (annual totals, mm/year; see research/conceptual_model.md):

  Soil zone:        P = ET_soil + Q_quick + R + dS_soil
  Groundwater zone: R = Q_base + ET_gw + A + dS_gw

  P       rainfall
  ET      actual evapotranspiration seen by satellite = ET_soil + ET_gw
  Q       river flow at the outlet = Q_quick + Q_base
  R       gross recharge (water reaching the water table)
  ET_gw   evaporation of groundwater (e.g. deep-rooted trees, valley bottoms)
  A       groundwater abstraction (pumping)

Consequences used in this project:
  S = P - ET                      "surplus": water left for river flow, recharge-minus-ET_gw, storage
  P - ET - Q = dS_soil + dS_gw    closure residual: about zero over multi-year means
  P - ET - Q_quick = R - ET_gw + dS_soil   "net recharge" (what a satellite balance can see)

Because satellite ET already contains ET_gw, a satellite balance estimates NET recharge, which is
smaller than the GROSS recharge measured by the water-table fluctuation method in wells.
"""

from __future__ import annotations

import numpy as np

SECONDS_PER_YEAR = 365.25 * 86400.0


def runoff_depth_mm(q_m3s, area_km2):
    """Convert mean discharge (m³/s) over a catchment (km²) to runoff depth (mm/year)."""
    return np.asarray(q_m3s, dtype=float) * SECONDS_PER_YEAR / (np.asarray(area_km2, dtype=float) * 1e6) * 1000.0


def surplus(p, et):
    """Rainfall minus actual evapotranspiration (mm/year)."""
    return np.asarray(p, dtype=float) - np.asarray(et, dtype=float)


def closure_residual(p, et, q):
    """P - ET - Q (mm/year). Over multi-year means this should be close to zero."""
    return surplus(p, et) - np.asarray(q, dtype=float)


def net_recharge_bounds(p, et, q_total):
    """Bounds on net recharge (R - ET_gw) when river flow is known but not split into quick/base flow.

    Quick flow lies between 0 and the total flow, so
        lower = P - ET - Q_total   (all river flow is quick flow)
        upper = P - ET             (no quick flow)

    Only meaningful when the balance closes (closure residual near zero over several years). It is not
    used for the results here, because the Upper Ouémé balance does not close.
    """
    s = surplus(p, et)
    return s - np.asarray(q_total, dtype=float), s


def et_bias_effect(et, bias_fraction):
    """Change in the surplus (mm/year) if ET were higher by `bias_fraction` (e.g. 0.1 = +10%)."""
    return -np.asarray(et, dtype=float) * float(bias_fraction)
