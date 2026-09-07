"""Real polygon bounds per ZCTA, from `public/data/zcta-geom.csv`.

This is what kills Bug 3. The frontend's auto-scale mode has to answer "which
ZIPs are in the viewport", and until now it answered with a 0.01-degree box
around each centroid — about 1.1 km, against a measured median ZCTA span of
7.45 km. Every large rural ZCTA fell out of its own viewport, which is why
auto-scaling over a view containing one big rural ZIP returns an empty set today.

Two things per ZCTA, both from the Census cartographic boundary file:

  lon, lat        an INNER point (mapshaper `-points inner`), guaranteed to lie
                  inside the polygon. Not a centroid: a centroid of a C-shaped or
                  multi-part ZCTA can land outside it, and this point is what the
                  popup and the tiny-ZIP dot layer position against.
  bw bs be bn     the polygon's real bounding box, in degrees, captured BEFORE
                  simplification so the box always contains the drawn shape.

The snapshot ships the bbox as four INT32 offsets from the anchor at x1e4. int32
and not int16 because the widest ZCTA is 99503 (Anchorage) at 8.3966 degrees of
longitude = 83,966, which is 2.6x int16's ceiling. An Int16Array here wraps
Alaska's bboxes silently and nothing downstream would notice.
"""

import csv
import logging
from pathlib import Path

from .contracts import PipelineError, assert_zip_format

log = logging.getLogger(__name__)

COLUMNS = ("ZCTA5CE20", "lon", "lat", "bw", "bs", "be", "bn")

# Continental US plus Alaska, Hawaii, Puerto Rico and the USVI — the same window
# the sidecar build script filters on. A row outside it means the territory
# filter changed upstream and the int32 offset argument needs re-checking.
LON_RANGE = (-180.0, -64.0)
LAT_RANGE = (17.0, 72.0)


def load(path: Path) -> dict:
    """Returns {zip: {lon, lat, bw, bs, be, bn}}, all floats in degrees."""
    if not path.exists():
        raise PipelineError(
            f"geometry sidecar missing: {path}. Build it with "
            f"`bash scripts/geometry/build_sidecar.sh`."
        )

    out: dict[str, dict] = {}
    with path.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        missing = [c for c in COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise PipelineError(
                f"{path.name}: missing column(s) {missing}. Header is "
                f"{reader.fieldnames!r}."
            )
        for row in reader:
            z = row["ZCTA5CE20"]
            try:
                rec = {c: float(row[c]) for c in COLUMNS[1:]}
            except (TypeError, ValueError) as e:
                raise PipelineError(f"{path.name}: ZIP {z!r} has a non-numeric column") from e
            if z in out:
                raise PipelineError(f"{path.name}: ZCTA5CE20 {z!r} appears twice")
            out[z] = rec

    if not out:
        raise PipelineError(f"{path.name} is empty")

    assert_zip_format(list(out), f"{path.name} ZCTA5CE20")
    _assert_boxes(out, path.name)

    log.info("Geometry: %s ZCTA bboxes from %s", f"{len(out):,}", path.name)
    return out


def _assert_boxes(rows: dict, name: str) -> None:
    """A5: every box is finite, non-degenerate, in range, and contains its anchor.

    The anchor check is the one that matters. `-points inner` and the bounds are
    computed by two separate mapshaper passes over two different files, so an
    anchor outside its own box means the passes disagreed about which feature is
    which — a join error that no amount of coordinate validation would catch.
    """
    bad_range, degenerate, outside = [], [], []
    for z, r in rows.items():
        if not (LON_RANGE[0] <= r["lon"] <= LON_RANGE[1]
                and LAT_RANGE[0] <= r["lat"] <= LAT_RANGE[1]):
            bad_range.append(z)
        if not (r["be"] > r["bw"] and r["bn"] > r["bs"]):
            degenerate.append(z)
        elif not (r["bw"] <= r["lon"] <= r["be"] and r["bs"] <= r["lat"] <= r["bn"]):
            outside.append(z)

    problems = []
    if bad_range:
        problems.append(
            f"  {len(bad_range):,} anchor(s) outside lon {LON_RANGE} / lat {LAT_RANGE}: "
            f"{bad_range[:5]!r}"
        )
    if degenerate:
        problems.append(f"  {len(degenerate):,} degenerate bbox(es): {degenerate[:5]!r}")
    if outside:
        problems.append(
            f"  {len(outside):,} anchor(s) outside their own bbox — the anchor pass and "
            f"the bounds pass disagree about feature identity: {outside[:5]!r}"
        )
    if problems:
        raise PipelineError(f"{name}: geometry contract violated.\n" + "\n".join(problems))


# Widest plausible ZCTA bounding box, in degrees. The widest real one is 99503
# (Anchorage) at 8.3966 degrees of longitude, so this is that with headroom and
# two orders of magnitude below any plausible mis-scaling.
MAX_SPAN_DEG = 10.0


def assert_bbox_scale(columns: dict[str, list[int]], scale: float, null: int) -> float:
    """Decode the encoded bbox columns and refuse a build whose boxes are absurd.

    This exists because the scale was applied twice for one release — `offsets`
    pre-multiplied by 1e4 and `serialize.COLUMNS` applied its declared 1e4 on top,
    so the wire carried degrees x1e8 under a header saying x1e4. The frontend
    honoured the header, and every ZIP claimed a box ~1,500 degrees wide. A box
    that size intersects every viewport, so the auto-scale viewport filter accepted
    everything and scaled to loaded tiles instead of to the view.

    Nothing caught it because the symptom — auto-scale producing a slightly odd
    scale — is what auto-scale looks like when it works. Checking the DECODED span
    is what makes the failure loud: it is the same arithmetic the frontend does,
    so the two cannot disagree about what the wire means.

    Returns the widest decoded span, for the manifest.
    """
    bw, bs, be, bn = (columns[k] for k in ("bw", "bs", "be", "bn"))
    widest = 0.0
    for i in range(len(bw)):
        if null in (bw[i], bs[i], be[i], bn[i]):
            continue
        span = max((be[i] - bw[i]) / scale, (bn[i] - bs[i]) / scale)
        if span > widest:
            widest = span
    if widest > MAX_SPAN_DEG:
        raise PipelineError(
            f"bbox scale check failed: widest decoded box is {widest:,.1f} degrees, "
            f"ceiling is {MAX_SPAN_DEG}. The widest real ZCTA is 8.3966 degrees "
            f"(99503, Anchorage), so bw/bs/be/bn are on the wrong scale — check that "
            f"`geom.offsets` returns DEGREES and that `serialize.COLUMNS` applies the "
            f"1e4 exactly once between them."
        )
    return round(widest, 4)


def offsets(rec: dict | None, lon: float | None, lat: float | None) -> tuple:
    """Bbox as four DEGREE offsets from (lon, lat), or four Nones.

    The offsets are relative to the ANCHOR the snapshot ships, not to the
    sidecar's own anchor, so the frontend can reconstruct absolute bounds with
    one add and never needs both numbers.

    DEGREES, NOT x1e4. This used to pre-multiply by 1e4 and `serialize.COLUMNS`
    then applied its declared scale of 1e4 on top, so the wire carried degrees
    x1e8 under a header that said x1e4. The frontend honoured the header and
    divided once, giving every ZIP a bounding box 10,000x too wide — a box
    spanning ~1,500 degrees intersects every viewport, so auto-scale's viewport
    filter accepted every loaded ZIP and silently scaled to loaded tiles instead
    of to the view. The double scaling was invisible because both failure modes
    look like "auto-scale did something".

    The scale belongs to `COLUMNS` and to nowhere else. With this returning
    degrees, the widest ZCTA — 99503, Anchorage, 8.3966 degrees of longitude —
    encodes to 83,966, which is the number the int32 argument in this module's
    docstring was computed from. That agreement is the check that the two halves
    now apply the scale exactly once between them.
    """
    if rec is None or lon is None or lat is None:
        return None, None, None, None
    return (
        rec["bw"] - lon,
        rec["bs"] - lat,
        rec["be"] - lon,
        rec["bn"] - lat,
    )
