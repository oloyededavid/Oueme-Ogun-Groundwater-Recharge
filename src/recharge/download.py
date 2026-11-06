"""Fetch a zipped vector dataset once, check its SHA-256 and unpack it."""

from __future__ import annotations

import hashlib
import subprocess
import zipfile
from pathlib import Path

# Zipped inputs used by the scripts, with the checksums of the files used for the published results.
HYDROBASINS_L09 = {
    "url": "https://data.hydrosheds.org/file/HydroBASINS/standard/hybas_af_lev09_v1c.zip",
    "sha256": "d5d28de9f25e65fa7825964e74d3b0496d4b4ab8274be5d7f10558dc357d6fd5",
    "zip": "hybas_af_lev09_v1c.zip", "folder": "hybas_lev09", "file": "hybas_af_lev09_v1c.shp",
}
NATURAL_EARTH_ADMIN0 = {
    "url": "https://naturalearth.s3.amazonaws.com/50m_cultural/ne_50m_admin_0_countries.zip",
    "sha256": "5fed433373581fa648920435f937d95f2d3c0200e067409c6478dcdf1b853139",
    "zip": "ne_50m_admin_0_countries.zip", "folder": "ne_admin0", "file": "ne_50m_admin_0_countries.shp",
}


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_unzipped(spec: dict, raw_dir: Path) -> Path:
    """Return the path of spec['file'] in raw_dir/spec['folder'], downloading and unpacking it if missing.

    A checksum mismatch stops the run, because a changed file could change the results.
    """
    target = raw_dir / spec["folder"] / spec["file"]
    if target.exists():
        return target
    zpath = raw_dir / spec["zip"]
    if not zpath.exists():
        raw_dir.mkdir(parents=True, exist_ok=True)
        print(f"downloading {spec['url']}", flush=True)
        subprocess.run(["curl", "-sS", "--fail", "-L", "--retry", "5", "-o", str(zpath), spec["url"]], check=True)
    digest = sha256_of(zpath)
    if digest != spec["sha256"]:
        raise SystemExit(f"SHA-256 of {zpath.name} is {digest}, expected {spec['sha256']}. "
                         "The source file has changed; check it before using it.")
    with zipfile.ZipFile(zpath) as z:
        z.extractall(raw_dir / spec["folder"])
    return target
