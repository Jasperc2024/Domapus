import csv
import json
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
import pytest

from pipeline import changes, classify, history, paint, redfin, serialize
from pipeline.contracts import PipelineError, RANGES, assert_ranges
from pipeline.units import LEVEL_HEADERS, READ_COLUMNS, YOY_HEADERS, resolve


def price_table(values, metric="median_sale_price", period="2026-09-30"):
    count = len(values)
    columns = {"PERIOD END": [period] * count,
               "REGION NAME": [f"{i:05d}" for i in range(count)]}
    for key in redfin.PRICE_METRICS:
        columns[LEVEL_HEADERS[key][0]] = values if key == metric else [10_000.0] * count
        columns[YOY_HEADERS[key][0]] = [5.0] * count
    return pa.table(columns)


@pytest.mark.parametrize("metric", redfin.PRICE_METRICS)
@pytest.mark.parametrize("bad", [0.0, -1.0, float("nan"), float("inf"), -float("inf"), 1e10])
def test_sparse_invalid_prices_and_their_yoy_are_null(metric, bad):
    lo, hi = RANGES[metric]
    values = [bad, lo, hi, *([10_000.0] * 997), None]
    quality = {}
    clean = redfin._clean_prices(price_table(values, metric), resolve(READ_COLUMNS, PipelineError), quality)
    assert clean[LEVEL_HEADERS[metric][0]].to_pylist() == [None, *values[1:]]
    assert clean[YOY_HEADERS[metric][0]][0].as_py() is None
    assert clean[YOY_HEADERS[metric][0]][1].as_py() == 5.0
    report = redfin._price_quality_report(quality)
    assert report["invalid_cells"] == 1
    assert report["affected"][0]["observed"] == 1000
    json.dumps(report, allow_nan=False)


@pytest.mark.parametrize("values", [
    [1.0] + [200_000.0] * 998,
    [1.0] + [None] * 999,
    [200.0] * 1000,
])
def test_excess_invalid_share_fails_even_with_many_nulls(values):
    quality = {}
    redfin._clean_prices(price_table(values), resolve(READ_COLUMNS, PipelineError), quality)
    with pytest.raises(PipelineError, match="price quarantine exceeds 0.1%.*"):
        redfin._price_quality_report(quality)


def test_quality_is_independent_of_csv_batch_boundaries():
    table = price_table([800.0] + [200_000.0] * 999)
    binding = resolve(READ_COLUMNS, PipelineError)
    whole, split = {}, {}
    redfin._clean_prices(table, binding, whole)
    for offset, size in [(0, 1), (1, 499), (500, 500)]:
        redfin._clean_prices(table.slice(offset, size), binding, split)
    assert redfin._price_quality_report(whole) == redfin._price_quality_report(split)


def test_clean_months_cannot_dilute_a_bad_month():
    quality = {}
    binding = resolve(READ_COLUMNS, PipelineError)
    redfin._clean_prices(price_table([1.0] + [200_000.0] * 998), binding, quality)
    redfin._clean_prices(price_table([200_000.0] * 10_000, period="2026-08-31"), binding, quality)
    with pytest.raises(PipelineError, match="median_sale_price 2026-09-30: 1/999"):
        redfin._price_quality_report(quality)


def test_optional_yoy_and_all_null_prices_remain_supported():
    header = YOY_HEADERS["median_sale_price"][0]
    table = price_table([None] * 1000, metric="median_ppsf").drop([header])
    price_header = LEVEL_HEADERS["median_sale_price"][0]
    table = table.set_column(table.schema.get_field_index(price_header), price_header,
                             pa.array([1.0] + [10_000.0] * 999))
    binding = resolve([h for h in READ_COLUMNS if h != header], PipelineError)
    quality = {}
    clean = redfin._clean_prices(table, binding, quality)
    assert clean[LEVEL_HEADERS["median_ppsf"][0]].null_count == 1000
    assert clean[price_header][0].as_py() is None
    assert redfin._price_quality_report(quality)["invalid_cells"] == 1


def test_non_price_range_contract_stays_fatal():
    with pytest.raises(PipelineError, match="range contract violated"):
        assert_ranges({"00123": {"avg_sale_to_list_ratio": 1.0134}}, "snapshot")


def write_feed(path, *, corrupt=False):
    fixture = Path(__file__).parent / "fixtures" / "redfin_sample.csv"
    with fixture.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        headers = reader.fieldnames
        templates = [row for row in reader if row["REGION NAME"] == "07002"]
    zips = ["39176", "62927", "79097", "58580"] + [f"{i:05d}" for i in range(2996)]
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=headers)
        writer.writeheader()
        for month, template in enumerate(templates):
            for i, zip_code in enumerate(zips):
                row = {**template, "REGION NAME": zip_code}
                if month == 0:
                    if corrupt or i < 3:
                        row[LEVEL_HEADERS["median_sale_price"][0]] = [800, 1, 319][i % 3]
                    if i < 3:
                        row[LEVEL_HEADERS["median_ppsf"][0]] = [0.45, 0.0, 0.08][i]
                    if i == 3:
                        row[LEVEL_HEADERS["median_list_ppsf"][0]] = 0.14
                if month == 12 and i == 4:
                    row[LEVEL_HEADERS["median_sale_price"][0]] = 1
                writer.writerow(row)
    return zips


def test_reported_october_failure_is_safe_through_history_and_changes(tmp_path, monkeypatch):
    feed, panel = tmp_path / "feed.csv", tmp_path / "panel.parquet"
    zips = write_feed(feed)
    monkeypatch.setattr(redfin, "BLOCK_SIZE", 1 << 20)
    report, rows = redfin.ingest(feed, panel)
    quality = report["price_quality"]
    assert quality["invalid_cells"] == 8
    assert {s["zip"] for e in quality["affected"] for s in e["samples"]} >= {
        "39176", "62927", "79097", "58580",
    }
    latest = redfin.latest_records(rows)
    meta = {z: {"city": "Testville", "county": "Test", "state": "NY", "metro": "Test",
                "lat": 40.0, "lng": -74.0} for z in zips}
    zillow = {z: {"zhvi": 500_000, "zhvi_mom": 0.5, "zhvi_yoy": 3.0} for z in zips}
    records, period, _ = serialize.assemble(meta, zillow, latest)
    changes.recompute(panel, records, period)
    serialize.validate(records, period, period)
    for zip_code in zips[:3]:
        for metric in ("median_sale_price", "median_ppsf"):
            assert records[zip_code][metric] is None
            assert records[zip_code][f"{metric}_yoy"] is None
        assert records[zip_code]["homes_sold"] == 102
    assert records["58580"]["median_list_ppsf"] is None
    assert records["58580"]["median_sale_price"] == 649856
    assert records[zips[4]]["median_sale_price"] == 649856
    assert records[zips[4]]["median_sale_price_yoy"] is None
    assert records[zips[5]]["median_sale_price_yoy"] is not None
    classify.assign(records, {"median_sale_price": [100_000 * i for i in range(1, 14)]})
    painted = paint.encode(records, "median_sale_price")
    assert all(painted[int(z)] == 0 for z in zips[:3])
    assert painted[int(zips[3])] != 0

    zhvi_panel = tmp_path / "zhvi.parquet"
    pq.write_table(pa.table({"zip": [zips[0]], "month": [period], "zhvi": [500_000.0]}), zhvi_panel)
    out = tmp_path / "history"
    history.write(panel, zhvi_panel, records, out, {})
    current = json.loads((out / "3917.json").read_text())["zips"]["39176"]
    assert current["msp"][-1] is None
    assert current["hs"][-1] == 102
    prior = json.loads((out / "0000.json").read_text())["zips"][zips[4]]
    assert prior["msp"][0] is None
    assert prior["msp"][-1] == 649856
    raw = pq.read_table(panel)
    newest = raw.filter(pc.equal(raw["period_end"], period))
    assert newest["median_sale_price"].null_count == 3


def test_widespread_corruption_cannot_return_a_successful_ingest(tmp_path):
    feed = tmp_path / "feed.csv"
    write_feed(feed, corrupt=True)
    with pytest.raises(PipelineError, match="median_sale_price.*3000/3000"):
        redfin.ingest(feed, tmp_path / "panel.parquet")
