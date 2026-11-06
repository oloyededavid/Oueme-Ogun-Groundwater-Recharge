"""Catchment delineation from HydroBASINS topology (HYBAS_ID -> NEXT_DOWN)."""

from __future__ import annotations

from collections import defaultdict
from typing import Iterable, Mapping

import geopandas as gpd
from pyproj import Geod


def upstream_ids(outlet_id: int, next_down: Mapping[int, int]) -> set[int]:
    """Return the outlet unit and every unit that drains into it.

    `next_down` maps each HYBAS_ID to the HYBAS_ID it drains into (0 = sink/ocean).
    """
    if outlet_id not in next_down:
        raise KeyError(f"Outlet {outlet_id} is not in the basin table.")
    children: dict[int, list[int]] = defaultdict(list)
    for unit, down in next_down.items():
        children[down].append(unit)
    found, stack = set(), [outlet_id]
    while stack:
        unit = stack.pop()
        if unit in found:
            continue
        found.add(unit)
        stack.extend(children.get(unit, []))
    return found


def geodesic_area_km2(geometry) -> float:
    """Area on the WGS84 ellipsoid in km² (geometry in EPSG:4326 lon/lat)."""
    area_m2, _ = Geod(ellps="WGS84").geometry_area_perimeter(geometry)
    return abs(area_m2) / 1e6


def dissolve_units(units: gpd.GeoDataFrame, ids: Iterable[int]):
    """Union of the HydroBASINS polygons with the given HYBAS_IDs."""
    sel = units[units["HYBAS_ID"].isin(list(ids))]
    if sel.empty:
        raise ValueError("No units selected.")
    return sel.geometry.union_all()
