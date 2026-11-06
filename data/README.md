# Data

All inputs are open data. Large originals are not stored in this repository: `scripts/02_download_data.py` downloads them, clips them to the two catchments, and records each original file's URL, size, access time and SHA-256 in `data/processed/provenance.json`.

| Dataset | Provider | Access | Resolution | Period used | Variable | Units / scaling | Licence | Purpose |
|---|---|---|---|---|---|---|---|---|
| WaPOR v3 L1-AETI-A | FAO | Public cloud-optimised GeoTIFFs on Google Cloud Storage (`fao-gismgr-wapor-3-data`), read as windows | 300 m (0.0029297°) | 2018–2024 | Actual evapotranspiration and interception | Int32 × 0.1 = mm/year | CC BY 4.0 | ET term |
| WaPOR v3 L1-PCP-A | FAO (from CHIRPS) | Same | ~5 km (0.05°) | 2018–2024 | Precipitation | Int32 × 0.1 = mm/year | CC BY 4.0 | Quality check only. Its values equal CHIRPS **v3.0** (checked for every year), although the metadata only says "CHIRPS" |
| WaPOR v3 L1-RET-A | FAO | Same | ~30 km | 2018–2024 | Reference ET | Int32 × 0.1 = mm/year | CC BY 4.0 | Context (ET/RET) |
| CHIRPS v2.0 global annual | Climate Hazards Center, UCSB | `https://data.chc.ucsb.edu/products/CHIRPS/v2.0/global_annual/tifs/` | 0.05° | 1981–2024 | Precipitation | mm/year | See CHC terms of use | Rainfall estimate; long-term baseline; maps |
| CHIRPS v3.0 Africa annual | Climate Hazards Center, UCSB | `https://data.chc.ucsb.edu/products/CHIRPS/v3.0/annual/africa/tifs/` | 0.05° | 1981–2024 | Precipitation (no-data not declared; negative values masked) | mm/year | See CHC terms of use | Second rainfall estimate; the version used by WaPOR v3 |
| TAMSAT v3.1 monthly | TAMSAT, University of Reading | `https://gws-access.jasmin.ac.uk/public/tamsat/rfe/data/v3.1/monthly/` | 0.0375° | 2018–2024; 1988–2010 (Upper Ouémé only) | `rfe_filled` (gap-filled estimate), summed over 12 months | mm/month | See TAMSAT terms | Third rainfall estimate (different algorithm; calibrated on gauges); 1988–2010 for the runoff-ratio check |
| HydroBASINS v1c level 9, Africa | HydroSHEDS / WWF | `https://data.hydrosheds.org/file/HydroBASINS/standard/hybas_af_lev09_v1c.zip` (SHA-256 `d5d28de9…6fd5`), downloaded by `scripts/01_build_basins.py` | Vector | — | Sub-basin polygons and topology | — | HydroSHEDS licence | Catchment boundaries |
| Natural Earth admin-0 countries, 1:50m | Natural Earth | `https://naturalearth.s3.amazonaws.com/50m_cultural/ne_50m_admin_0_countries.zip` (SHA-256 `5fed4333…3139`), downloaded by `scripts/05_figures.py` | Vector | — | Country outlines | — | Public domain | Location map only |
| Observed mean river flow at Bétérou | Proc. IAHS 383, 163–169 (2020), doi:10.5194/piahs-383-163-2020 | Published values | Station | 1971–1987, 1988–2010 | Mean annual flow | m³/s | — | Water-balance closure check |
| AMMA-CATCH groundwater levels (Upper Ouémé) | AMMA-CATCH observatory | `https://bd.amma-catch.org` (registration required) | Wells | 2018–2024 needed | Depth to water | m | AMMA-CATCH data policy | **Validation (pending)** |

## Folders

- `processed/basins.geojson`: the two catchments (from `scripts/01_build_basins.py`).
- `processed/rasters/<source>/<basin>_<year>.tif`: catchment clips (+0.1° margin), float32, mm/year.
- `processed/provenance.json`: where every input came from.
- `raw/` (not tracked): HydroBASINS and Natural Earth shapefiles (downloaded and checksum-checked by the scripts) and temporary downloads.

## Known limitations of the inputs

- **Different resolutions:** ET is 300 m, CHIRPS 5 km, TAMSAT 4 km, RET 30 km. Surplus maps are computed on the 5 km CHIRPS grid after averaging ET onto it; nothing is shown at a finer resolution than the coarsest input it uses.
- **WaPOR v3** has not been evaluated against flux towers in these catchments. WaPOR v2 errors across Africa are summarised in `research/literature_review.md`.
- **Rainfall products** use rain gauges for calibration. Gauge density in the two catchments is low, so the products are not fully independent of each other or of the long-term climatology.

## Getting the validation data (AMMA-CATCH)

1. Register at https://bd.amma-catch.org and accept the data policy.
2. Download the Benin groundwater-level series (Upper Ouémé wells and piezometers) for 2018–2024.
3. Save them as CSV files with columns `well_id, date, depth_to_water_m` in `data/raw/amma_catch/`.
4. Run `python scripts/04_validate_wtf.py`.
