"""Panel verification: measure P x Z, never recall it.

`build/panel.parquet` holds every (period, ZIP) cell — all 173 periods, not the
one the old pipeline kept. Everything in Phase 5 (the K lag sweep, YoY at lag 12,
LISA, the AR(1) fit, the 82-origin backtest) and all of Phase 7's history reads
from here.

P and Z are MEASURED on every run and written to `manifest.panel`. They are not
constants. Every figure derived from the old `171 x 24,619` shape is void — that
includes the "170 month-over-month transitions" the diff gate is calibrated on,
which is why the calibration script recomputes rather than hardcodes.
"""

import logging
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

from .contracts import PipelineError

log = logging.getLogger(__name__)


def dense(tbl, row_key: str, col_key: str, value_col: str,
          rows: list[str], cols: list[str]) -> np.ndarray:
    """One long panel column as a dense [len(rows) x len(cols)] array, NaN where absent.

    Four places needed this reshape — the K fit, the AR(1) fit, the pooled-YoY
    sample the diverging bound comes from, and the history writer — and each had
    written it out again, three of them building a Python dict over every key and
    walking it with `np.fromiter`. `pc.index_in` does the same lookup inside Arrow.
    MEASURED on the 4.93M-row Redfin panel: 1.68 s the old way, 0.30 s this way,
    matrices identical.

    `rows` and `cols` must COVER the table. An index that does not is the bug this
    reshape invites — a filtered axis list silently maps its missing keys to null,
    and `astype(int64)` turns that into an arbitrary index rather than an error.
    """
    i = pc.index_in(tbl[row_key], value_set=pa.array(rows))
    j = pc.index_in(tbl[col_key], value_set=pa.array(cols))
    if i.null_count or j.null_count:
        raise PipelineError(
            f"dense: {i.null_count + j.null_count} key(s) in the table are outside the "
            f"given {row_key}/{col_key} axes; the index does not cover the panel"
        )

    out = np.full((len(rows), len(cols)), np.nan)
    out[i.to_numpy(zero_copy_only=False).astype(np.int64),
        j.to_numpy(zero_copy_only=False).astype(np.int64)] = \
        tbl[value_col].to_numpy(zero_copy_only=False)
    return out


def verify(panel_path: Path, expected_rows: int) -> dict:
    """Measure the panel's shape and assert it matches what was written."""
    if not panel_path.exists():
        raise PipelineError(f"panel missing: {panel_path}")

    keys = pq.read_table(panel_path, columns=["zip", "period_end"])
    if keys.num_rows != expected_rows:
        raise PipelineError(
            f"panel: wrote {expected_rows:,} rows but the file holds {keys.num_rows:,}"
        )

    periods = pc.unique(keys["period_end"]).to_pylist()
    zips = pc.unique(keys["zip"]).to_pylist()

    report = {
        "rows": keys.num_rows,
        "periods": len(periods),
        "zips": len(zips),
        "period_min": min(periods),
        "period_max": max(periods),
        "bytes": panel_path.stat().st_size,
    }
    # The panel is ragged on purpose: not every ZIP reports in every period.
    # Rows <= P * Z, and rows == P * Z would mean the file is dense, which it is not.
    dense = report["periods"] * report["zips"]
    if report["rows"] > dense:
        raise PipelineError(
            f"panel: {report['rows']:,} rows exceeds {report['periods']} periods x "
            f"{report['zips']:,} ZIPs = {dense:,}. The key is not unique."
        )
    report["fill_rate"] = round(report["rows"] / dense, 4)

    log.info(
        "Panel: %s x %s = %s rows (%.1f%% filled), %s..%s, %.1f MB",
        report["periods"], f"{report['zips']:,}", f"{report['rows']:,}",
        report["fill_rate"] * 100, report["period_min"], report["period_max"],
        report["bytes"] / 1e6,
    )
    return report
