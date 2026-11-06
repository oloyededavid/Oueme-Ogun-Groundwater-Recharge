"""Classify years as dry, normal or wet against a long-term rainfall baseline."""

from __future__ import annotations

import numpy as np


def tercile_thresholds(values) -> tuple[float, float]:
    """33.3rd and 66.7th percentiles of the baseline values."""
    v = np.asarray(values, dtype=float)
    v = v[np.isfinite(v)]
    if v.size < 10:
        raise ValueError("Need at least 10 baseline years.")
    lo, hi = np.percentile(v, [100 / 3, 200 / 3])
    return float(lo), float(hi)


def classify(value: float, thresholds: tuple[float, float]) -> str:
    """'dry' below the lower tercile, 'wet' above the upper tercile, otherwise 'normal'."""
    lo, hi = thresholds
    if not np.isfinite(value):
        return "missing"
    if value < lo:
        return "dry"
    if value > hi:
        return "wet"
    return "normal"


def standardized_anomaly(value: float, baseline) -> float:
    """(value - baseline mean) / baseline standard deviation (sample SD, ddof=1)."""
    b = np.asarray(baseline, dtype=float)
    b = b[np.isfinite(b)]
    return float((value - b.mean()) / b.std(ddof=1))
