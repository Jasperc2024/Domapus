"""Calibrate the diff gate from the panel's own month-over-month transitions.

    python scripts/calibrate_diff_gate.py build/panel.parquet \
        temp-data/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv

Writes `tests/baselines/diff_gate.json`. Committed next to the baseline it
produces, so the numbers can be re-derived rather than trusted.

The rule: for each gated metric, take the share of ZIPs that moved more than 25%
between consecutive periods, over every real transition in the panel; the
threshold is the P99 of that distribution times 1.5.

**Not calibrated from `public/data/archive/*.json.gz`.** Those snapshots were
produced by the buggy pipeline — an arbitrary property type per ZIP, re-rolled
every run — so their month-over-month movement is dominated by the defect. Baking
that into the baseline would blind the gate to the exact failure it exists to
catch.
"""

import json
import math
import sys
from pathlib import Path

import numpy as np
import pyarrow.compute as pc
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tests" / "baselines" / "diff_gate.json"

sys.path.insert(0, str(ROOT))
from pipeline import panel, zhvi  # noqa: E402  (needs ROOT on the path first)

PANEL_METRICS = ["median_sale_price", "median_list_price", "median_ppsf"]
MOVE = 0.25
P = 0.99
SAFETY = 1.5

# A threshold floor, because the P99 x 1.5 rule degenerates on a smooth series.
# Measured: `zhvi` moved >25% for ZERO ZIPs in all 318 monthly transitions, so
# p99 and max are both 0.0 and the rule would set the threshold to 0.0 — a gate
# that fires on a single outlier ZIP. ZHVI is `sm_sa`, smoothed and seasonally
# adjusted, so that degeneracy is a property of the series, not a sampling
# artefact. 1% of ZIPs is small enough to catch a regime change and large enough
# not to fire on a handful of them.
FLOOR = 0.01


def _quantile(values, q):
    v = sorted(values)
    if not v:
        return None
    idx = (len(v) - 1) * q
    lo, hi = math.floor(idx), math.ceil(idx)
    return v[lo] * (1 - (idx - lo)) + v[hi] * (idx - lo)


def _moved_share(series: np.ndarray) -> list[float]:
    """Share of ZIPs that moved more than MOVE, per consecutive-period transition.

    `series` is [T x Z], oldest period first, NaN where a ZIP did not report. A
    cell counts as comparable only where both ends are present and the base is
    non-zero, which is the same test the row-at-a-time version made per cell.
    """
    out = []
    for i in range(1, len(series)):
        older, newer = series[i - 1], series[i]
        ok = np.isfinite(newer) & np.isfinite(older) & (older != 0.0)
        comparable = int(ok.sum())
        if comparable < 1000:
            continue
        moved = int((np.abs(newer[ok] / older[ok] - 1.0) > MOVE).sum())
        out.append(moved / comparable)
    return out


def from_panel(panel_path: Path) -> tuple[dict, dict]:
    """One dense [T x Z] array per metric — 47 MB each, against the ~3 GB the
    cell-at-a-time dict of dicts cost for the same 4.9M rows."""
    tbl = pq.read_table(panel_path, columns=["zip", "period_end"] + PANEL_METRICS)
    periods = sorted(pc.unique(tbl["period_end"]).to_pylist())
    zips = sorted(pc.unique(tbl["zip"]).to_pylist())

    dists = {
        m: _moved_share(panel.dense(tbl, "period_end", "zip", m, periods, zips))
        for m in PANEL_METRICS
    }
    return dists, {"transitions": len(periods) - 1, "periods": len(periods)}


def from_zhvi(csv_path: Path) -> list[float]:
    """ZHVI is not in the panel — calibrate it from its own wide monthly file.

    Parsed through `zhvi.read`, so this script and the pipeline agree on which
    columns are date columns and how a ZIP is spelled.
    """
    frame, date_cols = zhvi.read(csv_path.read_bytes())
    return _moved_share(frame[date_cols].to_numpy(dtype="float64").T)


def main() -> int:
    panel = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "build" / "panel.parquet"
    dists, meta = from_panel(panel)
    if len(sys.argv) > 2:
        dists["zhvi"] = from_zhvi(Path(sys.argv[2]))

    thresholds = {}
    for metric, dist in dists.items():
        if not dist:
            continue
        p99 = _quantile(dist, P)
        thresholds[metric] = {
            "moved_gt_25pct": round(min(1.0, max(p99 * SAFETY, FLOOR)), 5),
            "observed_p99": round(p99, 5),
            "observed_max": round(max(dist), 5),
            "observed_median": round(_quantile(dist, 0.5), 5),
            "transitions": len(dist),
        }

    payload = {
        "generated_from": {
            "panel": str(panel.name),
            "panel_periods": meta["periods"],
            "panel_transitions": meta["transitions"],
        },
        "rule": f"max(P{int(P * 100)} of the observed moved>{int(MOVE * 100)}% "
                f"distribution x {SAFETY}, floor {FLOOR})",
        "note": "NOT calibrated from public/data/archive/*.json.gz — those were "
                "produced by the buggy pipeline and would bake the defect in.",
        "thresholds": thresholds,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
