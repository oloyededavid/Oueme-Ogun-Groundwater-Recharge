# Methodology

## 1. Catchments (`scripts/01_build_basins.py`)

Both catchments are built from HydroBASINS v1c level 9 (Africa) by tracing every unit upstream of a fixed outlet unit through the `NEXT_DOWN` topology (`src/recharge/basins.py`).

- **Upper Ouémé at Bétérou** (Benin): outlet unit 1090852360, the unit containing the Bétérou bridge (9.19867°N, 2.26794°E). HydroBASINS upstream area 10,143.2 km², within 0.7% of published values (10,070–10,076 km²). The script fails if the gauge point is not inside the polygon.
- **Upper Ogun above the Oyan confluence** (Nigeria): outlet unit 1090928900, the same definition as Zone Z1 of the Ogun Catchment-to-Coast Observatory (upstream area 9,574.5 km²).

Polygon areas are computed on the WGS84 ellipsoid.

## 2. Inputs (`scripts/02_download_data.py`)

Annual totals for 2018–2024, plus CHIRPS 1981–2024 for the long-term baseline (details in `data/README.md`):

| Term | Product | Native resolution |
|---|---|---|
| Rainfall P | CHIRPS v2.0 annual; CHIRPS v3.0 annual (Africa); TAMSAT v3.1 monthly summed to annual (`rfe_filled`) | 0.05°; 0.05°; 0.0375° |
| Actual evapotranspiration ET | WaPOR v3 L1-AETI-A | 300 m |
| Reference ET | WaPOR v3 L1-RET-A | ~30 km |
| QA only | WaPOR v3 L1-PCP-A (equal to CHIRPS v3.0) | 0.05° |

## 3. Catchment means (`src/recharge/rasters.py`)

For each layer and year, the catchment mean is the area-weighted mean of all pixels whose centre lies inside the catchment, with weights proportional to cos(latitude). A mean is reported only if at least 95% of the catchment (by area) has valid data.

## 4. Rainfall context (`src/recharge/climate.py`)

The 1991–2020 annual totals of each catchment define terciles, separately for CHIRPS v2.0 and CHIRPS v3.0 (each version against its own record). Each year of 2018–2024 is classed **dry** (below the lower tercile), **wet** (above the upper tercile) or **normal**, and its standardized anomaly is reported (sample standard deviation of 1991–2020).

## 5. Water balance (`src/recharge/balance.py`; conceptual model in `conceptual_model.md`)

- **Surplus**: S = P − ET, for each of the three rainfall estimates. The spread between them is reported as rainfall uncertainty.
- **Expected river flow (Upper Ouémé only)**: published mean flows at Bétérou (47.5 m³/s for 1971–1987, 54.5 m³/s for 1988–2010) are converted to runoff depth over 10,072 km² (148.8 and 170.8 mm/year), giving runoff ratios of 0.136 and 0.142 of the rainfall reported for the same periods. Expected flow for each year of 2018–2024 = ratio × P. The higher ratio is used for the closure residual, which gives the smaller residual; both ratios define the band in the figures.
- **Closure residual**: P − ET − Q_expected. Over several years storage changes are small, so a residual far from zero means the products (or the transferred runoff ratio) are biased.
- **Closure diagnostics**: the change in ET, in rainfall or in the runoff ratio, one at a time, that would make the 2018–2024 mean residual zero; and the residual as a share of rainfall.
- **Storage check**: the water-table rise needed to store the summed 2018–2024 residual underground, for specific yield 0.2–1.5% (`SY_RANGE_CRYSTALLINE` in `src/recharge/wtf.py`; Lachassagne et al., 2021). A rise of tens of metres or more means the residual cannot be stored water.
- **Net-recharge bounds (not used)**: if the balance closed, net recharge would lie between P − ET − Q and P − ET (`conceptual_model.md`). The balance does not close, so these bounds would mostly reflect error and are not reported.
- **ET sensitivity**: change in S for a 10% change in ET (WaPOR v2 errors across Africa were 29–31%; Blatchford et al., 2020).
- **Published comparison**: recharge estimated from groundwater levels in Benin crystalline basement, about 4% of rainfall from 19–25-year records (Kotchoni et al., 2019) and 5–24% from two years of water-table data in the Donga sub-basin of the Upper Ouémé (Kamagaté et al., 2007). These are reference levels, not a validation.
- **Upper Ogun**: no river-flow data were available, so no closure check is possible. The figures show what flow would be at the Bétérou ratio, labelled as an assumption.

## 6. Maps

ET is shown at its native 300 m. The surplus is computed on the 0.05° CHIRPS grid after area-averaging ET onto that grid (`rasterio` average resampling), so the surplus map is never shown at a finer resolution than its coarsest input.

## 7. Validation (`scripts/04_validate_wtf.py`, pending data)

Two comparisons with AMMA-CATCH wells in the Upper Ouémé, both using specific yield 0.2–1.5% (Lachassagne, Dewandel & Wyns, 2021; to be replaced with site values if available):

1. **Gross recharge**, by the water-table fluctuation method (Healy & Cook, 2002): annual recharge = specific yield × annual water-table rise (peak minus the preceding minimum in the same calendar year). It is compared with the published recharge levels and the satellite surplus.
2. **Storage change**: the trend of annual mean head (m/year) × specific yield gives the yearly change in groundwater storage. It is compared with the closure residual. If the residual were stored water, the two would be similar; the storage check above suggests they will not be.

The code has been run on synthetic hydrographs only.

## 8. Quality checks recorded in `outputs/summary.json`

- Minimum valid-data fraction across all catchment means.
- WaPOR's precipitation layer vs CHIRPS v3.0 (should be identical).
- CHIRPS v3.0 − v2.0 and TAMSAT − CHIRPS v2.0 differences, and the spread of the three estimates, per catchment.

## 9. Tests

`tests/test_core.py` checks upstream tracing on a small network, area weighting, the runoff-depth conversion (54.5 m³/s over 10,072 km² = 170.8 mm/year), the balance arithmetic, tercile classification, the WTF calculation, and the storage and water-level-trend calculations, all against hand-calculated values or synthetic series.
