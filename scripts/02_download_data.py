"""Download the input data and clip it to the two catchments.

Sources (all open data):
  FAO WaPOR v3 Level 1, annual: actual evapotranspiration and interception (L1-AETI-A, 300 m),
      precipitation (L1-PCP-A, CHIRPS-based, ~5 km) and reference ET (L1-RET-A, ~30 km), 2018-2024.
      Read as windows from the public cloud-optimised GeoTIFFs (no full download).
  CHIRPS v2.0 global annual totals, 1981-2024 (Climate Hazards Center, UCSB).
  CHIRPS v3.0 Africa annual totals, 1981-2024 (the version behind WaPOR v3's precipitation layer).
  TAMSAT v3.1 monthly rainfall (University of Reading), 2018-2024, summed to annual totals.

Outputs: data/processed/rasters/<source>/<basin>_<year>.tif and data/processed/provenance.json.
Large original files are deleted after clipping; their URL, size and SHA-256 are recorded.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import xarray as xr
from rasterio.transform import from_origin
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from recharge.rasters import Subset, read_subset, save_subset  # noqa: E402

YEARS = range(2018, 2025)
CHIRPS_YEARS = range(1981, 2025)
PAD = 0.1  # degrees of padding around each catchment

WAPOR = "https://storage.googleapis.com/fao-gismgr-wapor-3-data/DATA/WAPOR-3/MAPSET/{m}/WAPOR-3.{m}.{y}.tif"
CHIRPS = "https://data.chc.ucsb.edu/products/CHIRPS/v2.0/global_annual/tifs/chirps-v2.0.{y}.tif"
CHIRPS3 = "https://data.chc.ucsb.edu/products/CHIRPS/v3.0/annual/africa/tifs/chirps-v3.0.{y}.tif"
TAMSAT = "https://gws-access.jasmin.ac.uk/public/tamsat/rfe/data/v3.1/monthly/{y}/{m:02d}/rfe{y}_{m:02d}.v3.1.nc"

OUT = ROOT / "data/processed/rasters"
TMP = ROOT / "data/raw/tmp"
PROV = ROOT / "data/processed/provenance.json"


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def curl(url: str, dest: Path, min_bytes: int) -> None:
    """Download with curl; retry on HTTP errors (including 429) with increasing waits."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(6):
        r = subprocess.run(["curl", "-sS", "--fail", "-m", "900", "-o", str(dest), url],
                           capture_output=True, text=True)
        if r.returncode == 0 and dest.exists() and dest.stat().st_size >= min_bytes:
            return
        wait = 15 * (attempt + 1)
        print(f"  retry {attempt + 1} for {url} in {wait}s ({r.stderr.strip()[:120]})", flush=True)
        time.sleep(wait)
    raise RuntimeError(f"Download failed: {url}")


def load_basins() -> dict:
    feats = json.loads((ROOT / "data/processed/basins.geojson").read_text())["features"]
    return {f["properties"]["basin_id"]: shape(f["geometry"]) for f in feats}


def main() -> None:
    basins = load_basins()
    prov = json.loads(PROV.read_text()) if PROV.exists() else {}

    # 1) WaPOR v3 (windowed reads of cloud-optimised GeoTIFFs; scale factor 0.1 -> mm/year)
    for m, folder in [("L1-AETI-A", "wapor_aeti"), ("L1-PCP-A", "wapor_pcp"), ("L1-RET-A", "wapor_ret")]:
        for y in YEARS:
            url = WAPOR.format(m=m, y=y)
            for b, geom in basins.items():
                dest = OUT / folder / f"{b}_{y}.tif"
                if dest.exists():
                    continue
                sub = read_subset("/vsicurl/" + url, geom.bounds, scale=0.1, pad_deg=PAD)
                save_subset(sub, dest, description=f"{m} {y}, mm/year, from {url}")
            prov[url] = {"accessed_utc": now(), "method": "windowed read (COG)", "scale": 0.1}
            print(f"WaPOR {m} {y} done", flush=True)
            PROV.write_text(json.dumps(prov, indent=1))

    # 2) CHIRPS v2.0 annual totals (full download, clip, delete)
    for y in CHIRPS_YEARS:
        dests = {b: OUT / "chirps_v2" / f"{b}_{y}.tif" for b in basins}
        if all(d.exists() for d in dests.values()):
            continue
        url = CHIRPS.format(y=y)
        tmp = TMP / f"chirps-v2.0.{y}.tif"
        curl(url, tmp, min_bytes=10_000_000)
        for b, geom in basins.items():
            save_subset(read_subset(str(tmp), geom.bounds, pad_deg=PAD), dests[b],
                        description=f"CHIRPS v2.0 annual total {y}, mm/year, from {url}")
        prov[url] = {"accessed_utc": now(), "bytes": tmp.stat().st_size, "sha256": sha256(tmp)}
        tmp.unlink()
        PROV.write_text(json.dumps(prov, indent=1))
        print(f"CHIRPS {y} done", flush=True)
        time.sleep(3)

    # 2b) CHIRPS v3.0 annual totals, Africa (the version used by WaPOR v3's L1-PCP layer).
    #     No-data is not declared in these files; negative values are masked.
    for y in CHIRPS_YEARS:
        dests = {b: OUT / "chirps_v3" / f"{b}_{y}.tif" for b in basins}
        if all(d.exists() for d in dests.values()):
            continue
        url = CHIRPS3.format(y=y)
        tmp = TMP / f"chirps-v3.0.{y}.tif"
        curl(url, tmp, min_bytes=1_000_000)
        for b, geom in basins.items():
            save_subset(read_subset(str(tmp), geom.bounds, pad_deg=PAD, valid_min=0.0), dests[b],
                        description=f"CHIRPS v3.0 annual total {y}, mm/year, from {url}")
        prov[url] = {"accessed_utc": now(), "bytes": tmp.stat().st_size, "sha256": sha256(tmp)}
        tmp.unlink()
        PROV.write_text(json.dumps(prov, indent=1))
        print(f"CHIRPS v3 {y} done", flush=True)
        time.sleep(3)

    # 3) TAMSAT v3.1 monthly -> annual totals (rfe_filled), clip, delete monthly files
    for y in YEARS:
        dests = {b: OUT / "tamsat_v3.1" / f"{b}_{y}.tif" for b in basins}
        if all(d.exists() for d in dests.values()):
            continue
        totals: dict[str, np.ndarray] = {}
        grids: dict[str, tuple] = {}
        for mo in range(1, 13):
            url = TAMSAT.format(y=y, m=mo)
            tmp = TMP / f"rfe{y}_{mo:02d}.v3.1.nc"
            curl(url, tmp, min_bytes=1_000_000)
            with xr.open_dataset(tmp) as ds:
                for b, geom in basins.items():
                    minx, miny, maxx, maxy = geom.bounds
                    da = ds["rfe_filled"].isel(time=0).sel(
                        lat=slice(maxy + PAD, miny - PAD), lon=slice(minx - PAD, maxx + PAD))
                    arr = da.values.astype(np.float64)
                    totals[b] = arr if mo == 1 else totals[b] + arr
                    grids[b] = (float(da.lon.values[0]), float(da.lat.values[0]), arr.shape)
            prov[url] = {"accessed_utc": now(), "bytes": tmp.stat().st_size, "sha256": sha256(tmp),
                         "variable": "rfe_filled"}
            tmp.unlink()
            time.sleep(1)
        for b in basins:
            lon0, lat0, _ = grids[b]
            res = 0.0375
            sub = Subset(data=totals[b], transform=from_origin(lon0 - res / 2, lat0 + res / 2, res, res),
                         crs="EPSG:4326")
            save_subset(sub, dests[b], description=f"TAMSAT v3.1 rfe_filled, sum of 12 months {y}, mm/year")
        PROV.write_text(json.dumps(prov, indent=1))
        print(f"TAMSAT {y} done", flush=True)


if __name__ == "__main__":
    main()
