import io
from datetime import datetime

import pandas as pd

from scripts.update_market_data import extract_zip_code, get_full_column_mapping, process_zillow_data


def test_extract_zip_code():
    assert extract_zip_code("Zip Code: 12345") == "12345"
    assert extract_zip_code("something Zip Code: 98765 something") == "98765"
    assert extract_zip_code("No zip here") is None
    assert extract_zip_code(None) is None


def test_get_full_column_mapping_keys():
    mapping = get_full_column_mapping()
    # A few critical keys should exist
    assert mapping["PERIOD_END"] == "period_end"
    assert mapping["MEDIAN_SALE_PRICE"] == "median_sale_price"
    assert mapping["AVG_SALE_TO_LIST"] == "avg_sale_to_list_ratio"
    assert mapping["OFF_MARKET_IN_TWO_WEEKS"] == "off_market_in_two_weeks"


def test_process_zillow_data_basic():
    # Build a minimal CSV with 13 monthly columns to exercise MOM/YOY
    base_date = datetime(2024, 1, 1)
    date_cols = [(base_date.replace(month=((i % 12) + 1), year=base_date.year + (i // 12))) for i in range(13)]
    date_headers = [d.strftime("%Y-%m-%d") for d in date_cols]

    data = {
        "RegionName": ["12345", "67890"],
        **{date_headers[i]: [100000 + i * 1000, 200000 + i * 2000] for i in range(13)},
    }

    df = pd.DataFrame(data)
    buf = io.BytesIO()
    df.to_csv(buf, index=False)

    results = process_zillow_data(buf.getvalue())

    assert "12345" in results
    assert "67890" in results

    # Verify values are present and formatted
    r = results["12345"]
    assert r["zhvi"] > 0
    assert r["zhvi_mom"] is not None
    assert r["zhvi_yoy"] is not None
