"""Read raster subsets for a catchment and compute area-weighted catchment means."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import from_bounds

GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
    "GDAL_HTTP_MAX_RETRY": "5",
    "GDAL_HTTP_RETRY_DELAY": "3",
}


@dataclass
class Subset:
    """A raster subset in physical units, with NaN outside valid data."""

    data: np.ndarray  # 2-D float64
    transform: rasterio.Affine
    crs: str


def read_subset(path: str, bounds: tuple[float, float, float, float], scale: float = 1.0,
                offset: float = 0.0, pad_deg: float = 0.1, valid_min: float | None = None) -> Subset:
    """Read the window covering `bounds` (lon/lat) plus padding, apply scale/offset, mask nodata.

    `valid_min` masks values below it (for files whose no-data value is not declared).
    """
    minx, miny, maxx, maxy = bounds
    with rasterio.Env(**GDAL_ENV), rasterio.open(path) as src:
        win = from_bounds(minx - pad_deg, miny - pad_deg, maxx + pad_deg, maxy + pad_deg, src.transform)
        win = win.round_offsets().round_lengths()
        raw = src.read(1, window=win, boundless=True, fill_value=src.nodata if src.nodata is not None else 0)
        transform = src.window_transform(win)
        nodata = src.nodata
        crs = src.crs.to_string() if src.crs else "EPSG:4326"
    data = raw.astype(np.float64)
    if nodata is not None:
        data[raw == nodata] = np.nan
    data = data * scale + offset
    if valid_min is not None:
        data[data < valid_min] = np.nan
    return Subset(data=data, transform=transform, crs=crs)


def save_subset(sub: Subset, path, description: str = "") -> None:
    """Write a subset as a compressed float32 GeoTIFF (NaN = no data)."""
    from pathlib import Path

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    profile = {
        "driver": "GTiff", "height": sub.data.shape[0], "width": sub.data.shape[1], "count": 1,
        "dtype": "float32", "crs": sub.crs, "transform": sub.transform, "nodata": np.nan,
        "compress": "deflate", "predictor": 3, "tiled": False,
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(sub.data.astype(np.float32), 1)
        if description:
            dst.update_tags(description=description)


def load_subset(path) -> Subset:
    """Read a GeoTIFF written by `save_subset`."""
    with rasterio.open(path) as src:
        data = src.read(1).astype(np.float64)
        if src.nodata is not None and not np.isnan(src.nodata):
            data[data == src.nodata] = np.nan
        return Subset(data=data, transform=src.transform, crs=src.crs.to_string())


def pixel_area_weights(shape: tuple[int, int], transform: rasterio.Affine) -> np.ndarray:
    """Relative pixel areas for a regular lon/lat grid (proportional to cos(latitude))."""
    rows = np.arange(shape[0]) + 0.5
    lat = transform.f + rows * transform.e
    w = np.cos(np.deg2rad(lat))
    return np.repeat(w[:, None], shape[1], axis=1)


def inside_mask(geometry, shape: tuple[int, int], transform: rasterio.Affine) -> np.ndarray:
    """True for pixels whose centre lies inside the polygon."""
    return geometry_mask([geometry], out_shape=shape, transform=transform, invert=True, all_touched=False)


def catchment_mean(sub: Subset, geometry, min_valid_fraction: float = 0.95) -> tuple[float, float]:
    """Area-weighted mean over pixels inside the catchment.

    Returns (mean, valid_fraction). The mean is NaN if fewer than `min_valid_fraction`
    of the catchment's pixels (by area) have valid data.
    """
    inside = inside_mask(geometry, sub.data.shape, sub.transform)
    if not inside.any():
        raise ValueError("No pixel centres fall inside the catchment.")
    w = pixel_area_weights(sub.data.shape, sub.transform)
    valid = inside & np.isfinite(sub.data)
    frac = float(w[valid].sum() / w[inside].sum())
    if frac < min_valid_fraction:
        return float("nan"), frac
    return float(np.sum(sub.data[valid] * w[valid]) / np.sum(w[valid])), frac
