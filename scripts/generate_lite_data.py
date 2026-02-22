import json
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "public" / "data"
LITE_FIELDS = ['city', 'county', 'state', 'metro', 'lat', 'lng', 'period_end', 'zhvi']


def generate_lite_data(input_path=None, output_path=None):
    input_path = input_path or DATA_DIR / "zip-data.json"
    output_path = output_path or DATA_DIR / "zip-data-lite.json"

    if not input_path.exists():
        logging.error(f"Input file not found: {input_path}")
        return False

    logging.info(f"Reading full data from {input_path}...")
    with open(input_path, 'r', encoding='utf-8') as f:
        full_data = json.load(f)

    # Validate columnar format
    if not all(k in full_data for k in ('f', 'z', 'd', 'last_updated_utc')):
        logging.error("Input file is not in expected columnar format (f, z, d, last_updated_utc)")
        return False

    fields = full_data['f']
    zip_codes = full_data['z']
    rows = full_data['d']

    # Find column indices for lite fields
    lite_indices = []
    lite_field_names = []
    for field in LITE_FIELDS:
        if field in fields:
            lite_indices.append(fields.index(field))
            lite_field_names.append(field)
        else:
            logging.warning(f"Field '{field}' not found in full data, skipping")

    logging.info(f"Extracting {len(lite_field_names)} fields: {lite_field_names}")

    # Extract only the lite columns from each row
    lite_rows = []
    for row in rows:
        lite_row = [row[i] for i in lite_indices]
        lite_rows.append(lite_row)

    lite_data = {
        "last_updated_utc": full_data['last_updated_utc'],
        "f": lite_field_names,
        "z": zip_codes,
        "d": lite_rows
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(lite_data, f, separators=(",", ":"))

    input_size = input_path.stat().st_size / 1024
    output_size = output_path.stat().st_size / 1024
    reduction = (1 - output_size / input_size) * 100

    logging.info(f"Lite file generated: {output_path}")
    logging.info(f"  Full:  {input_size:.1f} KB")
    logging.info(f"  Lite:  {output_size:.1f} KB")
    logging.info(f"  Reduction: {reduction:.1f}%")
    logging.info(f"  ZCTAs: {len(zip_codes)}, Fields: {len(lite_field_names)}")

    return True


if __name__ == "__main__":
    success = generate_lite_data()
    sys.exit(0 if success else 1)
