"""Build the two study catchments from HydroBASINS v1c level 9 (Africa).

Outlets (HYBAS_ID, level 9):
  Upper Ouémé at Bétérou (Benin): 1090852360, the unit containing the Bétérou
      bridge (9.19867 N, 2.26794 E). HydroBASINS UP_AREA = 10,143.2 km²; published
      areas for the Bétérou catchment are 10,070-10,076 km².
  Upper Ogun above the Oyan confluence (Nigeria): 1090928900, the same outlet used
      in the Ogun Catchment-to-Coast Observatory (UP_AREA = 9,574.5 km²).

Input : data/raw/hybas_lev09/hybas_af_lev09_v1c.shp (downloaded and checksum-checked if missing)
Output: data/processed/basins.geojson
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Point, mapping

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from recharge.basins import dissolve_units, geodesic_area_km2, upstream_ids  # noqa: E402
from recharge.download import HYDROBASINS_L09, ensure_unzipped  # noqa: E402

OUT = ROOT / "data/processed/basins.geojson"

BASINS = [
    {
        "basin_id": "upper_oueme",
        "name": "Upper Ouémé at Bétérou",
        "country": "Benin",
        "outlet_hybas_id": 1090852360,
        "outlet_note": "Unit containing the Bétérou bridge (9.19867 N, 2.26794 E)",
        "published_area_km2": "10,070-10,076",
    },
    {
        "basin_id": "upper_ogun",
        "name": "Upper Ogun above the Oyan confluence",
        "country": "Nigeria",
        "outlet_hybas_id": 1090928900,
        "outlet_note": "Same outlet as Zone Z1 of the Ogun Catchment-to-Coast Observatory",
        "published_area_km2": None,
    },
]


def main() -> None:
    units = gpd.read_file(ensure_unzipped(HYDROBASINS_L09, ROOT / "data/raw"), bbox=(0.5, 5.5, 5.0, 11.5))
    next_down = dict(zip(units["HYBAS_ID"].astype(int), units["NEXT_DOWN"].astype(int)))
    features = []
    for b in BASINS:
        ids = upstream_ids(b["outlet_hybas_id"], next_down)
        geom = dissolve_units(units, ids)
        outlet = units.loc[units["HYBAS_ID"] == b["outlet_hybas_id"]].iloc[0]
        props = {
            **b,
            "hydrobasins_level": 9,
            "n_units": len(ids),
            "hydrobasins_up_area_km2": float(outlet["UP_AREA"]),
            "geodesic_area_km2": round(geodesic_area_km2(geom), 1),
        }
        features.append({"type": "Feature", "properties": props, "geometry": mapping(geom)})
        print(f"{b['name']}: {len(ids)} units, UP_AREA {outlet['UP_AREA']:.1f} km², "
              f"polygon {props['geodesic_area_km2']:.1f} km²")

    # Sanity check: the Bétérou point must fall inside the Upper Ouémé polygon.
    oueme = gpd.GeoDataFrame.from_features([features[0]], crs="EPSG:4326").geometry.iloc[0]
    if not oueme.contains(Point(2.26794, 9.19867)):
        raise RuntimeError("Bétérou point is not inside the Upper Ouémé polygon.")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
