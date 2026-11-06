"""Catchment water balance, rainfall context and a closure check against observed river flow.

Reads the clipped rasters from scripts/02_download_data.py and writes:
  outputs/annual_balance.csv     one row per catchment and year, 2018-2024
  outputs/long_term_chirps.csv   CHIRPS v2.0 and v3.0 annual catchment rainfall, 1981-2024
  outputs/summary.json           multi-year means, closure check, QA checks
  outputs/maps/*.tif             mean 2018-2024 rainfall, ET and surplus grids (CHIRPS v2.0 based)

Rainfall products (keys used in column names):
  chirps2 = CHIRPS v2.0, chirps3 = CHIRPS v3.0 (identical to WaPOR v3 L1-PCP), tamsat = TAMSAT v3.1
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from rasterio.warp import Resampling, reproject
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from recharge.balance import closure_residual, et_bias_effect, runoff_depth_mm, surplus  # noqa: E402
from recharge.climate import classify, standardized_anomaly, tercile_thresholds  # noqa: E402
from recharge.rasters import Subset, catchment_mean, inside_mask, load_subset, save_subset  # noqa: E402
from recharge.wtf import SY_RANGE_CRYSTALLINE, head_change_for_storage_m  # noqa: E402

RASTERS = ROOT / "data/processed/rasters"
OUT = ROOT / "outputs"
YEARS = list(range(2018, 2025))
LONG_YEARS = list(range(1981, 2025))
BASELINE = (1991, 2020)
PRODUCTS = {"chirps2": "chirps_v2", "chirps3": "chirps_v3", "tamsat": "tamsat_v3.1"}

# Observed mean flow at Ouémé-Bétérou (Proc. IAHS 383, 163-169, 2020, doi:10.5194/piahs-383-163-2020)
# and published catchment area at Bétérou (10,070-10,076 km²; 10,072 km² used).
BETEROU = {"area_km2": 10072.0,
           "periods": {"1971-1987": {"q_m3s": 47.5, "rain_mm": 1091.0},
                       "1988-2010": {"q_m3s": 54.5, "rain_mm": 1202.0}}}
# Published groundwater recharge in Benin crystalline basement, as fractions of annual rainfall:
#   Kotchoni et al. (2019), Hydrogeology Journal 27, 447-457, doi:10.1007/s10040-018-1806-2:
#     about 4%, from 19-25-year hydrographs of a weathered-crystalline aquifer;
#   Kamagaté et al. (2007), Comptes Rendus Géoscience 339, 418-429, doi:10.1016/j.crte.2007.04.003:
#     5-24%, from two years of water-table monitoring in the 586 km² Donga sub-basin of the Upper Ouémé.
RECHARGE_REFS = {"kotchoni2019": (0.04, 0.04), "kamagate2007": (0.05, 0.24)}
KOTCHONI_FRACTION = RECHARGE_REFS["kotchoni2019"][0]


def load_basins():
    feats = json.loads((ROOT / "data/processed/basins.geojson").read_text())["features"]
    return {f["properties"]["basin_id"]: (shape(f["geometry"]), f["properties"]) for f in feats}


def basin_mean(source: str, basin: str, year: int, geom):
    return catchment_mean(load_subset(RASTERS / source / f"{basin}_{year}.tif"), geom)


def mean_grid(source: str, basin: str, years) -> Subset:
    subs = [load_subset(RASTERS / source / f"{basin}_{y}.tif") for y in years]
    return Subset(np.nanmean(np.stack([s.data for s in subs]), axis=0), subs[0].transform, subs[0].crs)


def regrid_average(src: Subset, target: Subset) -> Subset:
    """Area-average a fine grid (e.g. 300 m ET) onto a coarse grid (e.g. 0.05° CHIRPS)."""
    dst = np.full(target.data.shape, np.nan)
    reproject(src.data, dst, src_transform=src.transform, src_crs=src.crs, src_nodata=np.nan,
              dst_transform=target.transform, dst_crs=target.crs, dst_nodata=np.nan,
              resampling=Resampling.average)
    return Subset(dst, target.transform, target.crs)


def masked_save(sub: Subset, geom, path: Path, description: str) -> None:
    data = sub.data.copy()
    data[~inside_mask(geom, data.shape, sub.transform)] = np.nan
    save_subset(Subset(data, sub.transform, sub.crs), path, description=description)


def main() -> None:
    basins = load_basins()
    OUT.mkdir(exist_ok=True)
    rows, long_rows, qa = [], [], {"min_valid_fraction": 1.0}

    def track(f):
        qa["min_valid_fraction"] = min(qa["min_valid_fraction"], f)

    for b, (geom, _) in basins.items():
        for y in LONG_YEARS:
            r = {"basin_id": b, "year": y}
            for key in ("chirps2", "chirps3"):
                v, f = basin_mean(PRODUCTS[key], b, y, geom); track(f)
                r[f"p_{key}_mm"] = v
            long_rows.append(r)
        for y in YEARS:
            row = {"basin_id": b, "year": y}
            for key, src in PRODUCTS.items():
                v, f = basin_mean(src, b, y, geom); track(f)
                row[f"p_{key}_mm"] = v
            for col, src in [("p_wapor_mm", "wapor_pcp"), ("et_wapor_mm", "wapor_aeti"), ("ret_wapor_mm", "wapor_ret")]:
                v, f = basin_mean(src, b, y, geom); track(f)
                row[col] = v
            rows.append(row)

    lt = pd.DataFrame(long_rows)
    df = pd.DataFrame(rows)
    pcols = [f"p_{k}_mm" for k in PRODUCTS]

    summary = {"basins": {}, "qa": qa}
    for b, (geom, props) in basins.items():
        sel = df.basin_id == b
        info = {"name": props["name"], "country": props["country"], "area_km2": props["geodesic_area_km2"]}
        for key in ("chirps2", "chirps3"):
            base = lt[(lt.basin_id == b) & lt.year.between(*BASELINE)][f"p_{key}_mm"].values
            terc = tercile_thresholds(base)
            df.loc[sel, f"rain_class_{key}"] = [classify(v, terc) for v in df.loc[sel, f"p_{key}_mm"]]
            df.loc[sel, f"rain_anomaly_sd_{key}"] = [standardized_anomaly(v, base) for v in df.loc[sel, f"p_{key}_mm"]]
            info[f"baseline_1991_2020_mean_{key}_mm"] = float(np.mean(base))
            info[f"baseline_terciles_{key}_mm"] = terc
        summary["basins"][b] = info

    # Water balance
    df["p_min_mm"] = df[pcols].min(axis=1)
    df["p_max_mm"] = df[pcols].max(axis=1)
    df["p_spread_mm"] = df.p_max_mm - df.p_min_mm
    df["et_over_ret"] = df.et_wapor_mm / df.ret_wapor_mm
    for k in PRODUCTS:
        df[f"surplus_{k}_mm"] = surplus(df[f"p_{k}_mm"], df.et_wapor_mm)
        df[f"et_over_p_{k}"] = df.et_wapor_mm / df[f"p_{k}_mm"]
    df["surplus_change_if_et_plus10pct_mm"] = et_bias_effect(df.et_wapor_mm, 0.10)
    df["kotchoni_4pct_low_mm"] = KOTCHONI_FRACTION * df.p_min_mm
    df["kotchoni_4pct_high_mm"] = KOTCHONI_FRACTION * df.p_max_mm

    # Observed runoff ratio at Bétérou (Upper Ouémé only)
    ratios = {}
    for per, v in BETEROU["periods"].items():
        q_mm = float(runoff_depth_mm(v["q_m3s"], BETEROU["area_km2"]))
        ratios[per] = {"runoff_mm": q_mm, "rain_mm": v["rain_mm"], "runoff_ratio": q_mm / v["rain_mm"]}
    r_lo = min(r["runoff_ratio"] for r in ratios.values())
    r_hi = max(r["runoff_ratio"] for r in ratios.values())
    oue = df.basin_id == "upper_oueme"
    for k in PRODUCTS:
        p = df.loc[oue, f"p_{k}_mm"]
        q_hi = r_hi * p
        df.loc[oue, f"q_expected_{k}_mm"] = q_hi
        df.loc[oue, f"closure_residual_{k}_mm"] = closure_residual(p, df.loc[oue, "et_wapor_mm"], q_hi)
    summary["beterou_observed_runoff"] = {"area_km2": BETEROU["area_km2"], "periods": ratios, "ratio_range": [r_lo, r_hi]}

    # What it would take to close the 2018-2024 mean balance at Bétérou (one term at a time), and whether
    # the residual could be water stored underground (it would raise the water table by the amounts below)
    o = df[oue]
    sy_min, sy_max = SY_RANGE_CRYSTALLINE
    closure = {}
    for k in PRODUCTS:
        res = float(o[f"closure_residual_{k}_mm"].mean())
        cum = float(o[f"closure_residual_{k}_mm"].sum())
        p_m, et_m = float(o[f"p_{k}_mm"].mean()), float(o.et_wapor_mm.mean())
        closure[k] = {
            "mean_surplus_mm": float(o[f"surplus_{k}_mm"].mean()),
            "mean_expected_flow_mm": float(o[f"q_expected_{k}_mm"].mean()),
            "mean_closure_residual_mm": res,
            "residual_as_pct_of_expected_flow": 100 * res / float(o[f"q_expected_{k}_mm"].mean()),
            "et_increase_needed_pct": 100 * res / et_m,
            # Expected flow is r_hi x rainfall, so lowering rainfall also lowers expected flow:
            # (1 - r_hi)(P - dP) = ET  ->  dP = residual / (1 - r_hi)
            "rain_decrease_needed_pct": 100 * res / ((1 - r_hi) * p_m),
            "runoff_ratio_needed": float(o[f"surplus_{k}_mm"].mean()) / p_m,
            "years_with_positive_residual": int((o[f"closure_residual_{k}_mm"] > 0).sum()),
            "residual_pct_of_rainfall": 100 * res / p_m,
            "residual_over_4pct_recharge": res / (KOTCHONI_FRACTION * p_m),
            "cumulative_residual_mm": cum,
            "sy_range": [sy_min, sy_max],
            "water_table_rise_if_stored_m": [float(head_change_for_storage_m(cum, sy_max)),
                                             float(head_change_for_storage_m(cum, sy_min))],
        }
    summary["closure_upper_oueme_2018_2024"] = closure

    # Robustness: the runoff ratio from each CHIRPS version's own 1988-2010 rainfall, instead of the
    # rainfall published with the flow record, and the gap it gives for 2018-2024
    q8810 = ratios["1988-2010"]["runoff_mm"]
    own = {}
    for key in ("chirps2", "chirps3"):
        p_hist = float(lt[(lt.basin_id == "upper_oueme") & lt.year.between(1988, 2010)][f"p_{key}_mm"].mean())
        r_own = q8810 / p_hist
        p_m, et_m = float(o[f"p_{key}_mm"].mean()), float(o.et_wapor_mm.mean())
        own[key] = {"p_1988_2010_mm": p_hist, "runoff_ratio": r_own, "mean_closure_residual_mm": p_m - et_m - r_own * p_m}
    summary["closure_check_own_product_ratio"] = own
    summary["published_recharge_fraction"] = {k: list(v) for k, v in RECHARGE_REFS.items()}

    # Multi-year means (2018-2024)
    num_cols = [c for c in df.select_dtypes("number").columns if c != "year"]
    means = df.groupby("basin_id")[num_cols].mean()
    for b in basins:
        summary["basins"][b]["mean_2018_2024"] = {k: (None if pd.isna(v) else float(v)) for k, v in means.loc[b].items()}
        for key in ("chirps2", "chirps3"):
            s = df[df.basin_id == b]
            summary["basins"][b][f"rain_classes_{key}"] = dict(zip(s.year.astype(int).astype(str), s[f"rain_class_{key}"]))
            summary["basins"][b][f"rain_class_counts_{key}"] = {c: int((s[f"rain_class_{key}"] == c).sum()) for c in ("dry", "normal", "wet")}
            base_mean = summary["basins"][b][f"baseline_1991_2020_mean_{key}_mm"]
            summary["basins"][b][f"period_vs_baseline_pct_{key}"] = 100 * (float(s[f"p_{key}_mm"].mean()) / base_mean - 1)

    # QA
    qa["wapor_pcp_minus_chirps3_mm"] = {"mean": float((df.p_wapor_mm - df.p_chirps3_mm).mean()),
                                         "max_abs": float((df.p_wapor_mm - df.p_chirps3_mm).abs().max())}
    for b in basins:
        s = df[df.basin_id == b]
        qa[f"{b}_chirps3_minus_chirps2_mm"] = {"mean": float((s.p_chirps3_mm - s.p_chirps2_mm).mean()),
                                               "min": float((s.p_chirps3_mm - s.p_chirps2_mm).min()),
                                               "max": float((s.p_chirps3_mm - s.p_chirps2_mm).max())}
        qa[f"{b}_tamsat_minus_chirps2_mm_mean"] = float((s.p_tamsat_mm - s.p_chirps2_mm).mean())
        qa[f"{b}_product_spread_mm"] = {"mean": float(s.p_spread_mm.mean()), "max": float(s.p_spread_mm.max())}

    # Mean 2018-2024 grids: ET at native 300 m; surplus on the CHIRPS 0.05° grid (no false detail)
    (OUT / "maps").mkdir(exist_ok=True)
    for b, (geom, _) in basins.items():
        et = mean_grid("wapor_aeti", b, YEARS)
        p = mean_grid("chirps_v2", b, YEARS)
        s = Subset(p.data - regrid_average(et, p).data, p.transform, p.crs)
        masked_save(et, geom, OUT / "maps" / f"{b}_et_mean_300m.tif", "WaPOR v3 AETI, 2018-2024 mean, mm/year")
        masked_save(p, geom, OUT / "maps" / f"{b}_p_chirps2_mean_0p05.tif", "CHIRPS v2.0, 2018-2024 mean, mm/year")
        masked_save(s, geom, OUT / "maps" / f"{b}_surplus_mean_0p05.tif", "CHIRPS v2.0 minus WaPOR ET, 2018-2024 mean")
        for y in YEARS:
            py = load_subset(RASTERS / "chirps_v2" / f"{b}_{y}.tif")
            ey = regrid_average(load_subset(RASTERS / "wapor_aeti" / f"{b}_{y}.tif"), py)
            masked_save(Subset(py.data - ey.data, py.transform, py.crs), geom, OUT / "maps" / f"{b}_surplus_{y}.tif",
                        f"CHIRPS v2.0 minus WaPOR ET {y}, mm/year, 0.05 degree")

    df.to_csv(OUT / "annual_balance.csv", index=False, float_format="%.2f")
    lt.to_csv(OUT / "long_term_chirps.csv", index=False, float_format="%.2f")
    (OUT / "summary.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False))
    show = ["basin_id", "year"] + pcols + ["et_wapor_mm"] + [f"surplus_{k}_mm" for k in PRODUCTS] + ["rain_class_chirps2", "rain_class_chirps3"]
    print(df[show].round(0).to_string(index=False))
    print(json.dumps({"qa": qa, "beterou": summary["beterou_observed_runoff"]}, indent=1))


if __name__ == "__main__":
    main()
