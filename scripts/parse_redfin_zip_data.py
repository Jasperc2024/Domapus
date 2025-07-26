import pandas as pd
import requests
import gzip
import json
import random
import re
from datetime import datetime, timezone
from pathlib import Path
import logging
from io import BytesIO

logging.basicConfig(filename='data_pipeline.log', filemode='w', level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

def load_zip_mapping_data(file_path='public/data/zip-city-mapping.csv.gz'):
    """Loads the pre-cleaned ZIP to city, county, and coordinate mapping file."""
    try:
        logging.info(f"Loading ZIP mapping data from {file_path}...")
        df = pd.read_csv(file_path, compression='gzip', dtype={'ZipCode': str})
        df.set_index('ZipCode', inplace=True)
        logging.info(f"Successfully loaded {len(df)} unique mapping entries.")
        return df.to_dict('index')
    except Exception as e:
        logging.error(f"CRITICAL ERROR loading {file_path}: {e}")
        return None

def download_redfin_data(url, timeout=300, retries=3):
    """Downloads the Redfin data file with retries."""
    for attempt in range(1, retries + 1):
        try:
            logging.info(f"Attempt {attempt}: Downloading data from {url}...")
            response = requests.get(url, timeout=timeout, stream=True)
            response.raise_for_status()
            return response.content
        except requests.exceptions.RequestException as e:
            logging.error(f"Download failed (attempt {attempt}): {e}")
    logging.critical("All download attempts failed.")
    return None

def extract_zip_code(region_str):
    """Extracts a 5-digit ZIP code from the Redfin 'region' string."""
    if pd.isna(region_str): return None
    match = re.search(r'Zip Code:\s*(\d{5})', str(region_str))
    return match.group(1) if match else None

def get_full_column_mapping():
    """Defines the mapping for ALL Redfin columns to our snake_case standard."""
    return {
        'STATE': 'state', 'PARENT_METRO_REGION': 'parent_metro', 'PERIOD_END': 'period_end',
        'MEDIAN_SALE_PRICE': 'median_sale_price', 'MEDIAN_SALE_PRICE_MOM': 'median_sale_price_mom_pct', 'MEDIAN_SALE_PRICE_YOY': 'median_sale_price_yoy_pct',
        'MEDIAN_LIST_PRICE': 'median_list_price', 'MEDIAN_LIST_PRICE_MOM': 'median_list_price_mom_pct', 'MEDIAN_LIST_PRICE_YOY': 'median_list_price_yoy_pct',
        'MEDIAN_PPSF': 'median_ppsf', 'MEDIAN_PPSF_MOM': 'median_ppsf_mom_pct', 'MEDIAN_PPSF_YOY': 'median_ppsf_yoy_pct',
        'MEDIAN_LIST_PPSF': 'median_list_ppsf', 'MEDIAN_LIST_PPSF_MOM': 'median_list_ppsf_mom_pct', 'MEDIAN_LIST_PPSF_YOY': 'median_list_ppsf_yoy_pct',
        'HOMES_SOLD': 'homes_sold', 'HOMES_SOLD_MOM': 'homes_sold_mom_pct', 'HOMES_SOLD_YOY': 'homes_sold_yoy_pct',
        'PENDING_SALES': 'pending_sales', 'PENDING_SALES_MOM': 'pending_sales_mom_pct', 'PENDING_SALES_YOY': 'pending_sales_yoy_pct',
        'NEW_LISTINGS': 'new_listings', 'NEW_LISTINGS_MOM': 'new_listings_mom_pct', 'NEW_LISTINGS_YOY': 'new_listings_yoy_pct',
        'INVENTORY': 'inventory', 'INVENTORY_MOM': 'inventory_mom_pct', 'INVENTORY_YOY': 'inventory_yoy_pct',
        'MONTHS_OF_SUPPLY': 'months_of_supply', 'MONTHS_OF_SUPPLY_MOM': 'months_of_supply_mom_pct', 'MONTHS_OF_SUPPLY_YOY': 'months_of_supply_yoy_pct',
        'MEDIAN_DOM': 'median_dom', 'MEDIAN_DOM_MOM': 'median_dom_mom_pct', 'MEDIAN_DOM_YOY': 'median_dom_yoy_pct',
        'AVG_SALE_TO_LIST': 'avg_sale_to_list_ratio', 'AVG_SALE_TO_LIST_MOM': 'avg_sale_to_list_mom_pct', 'AVG_SALE_TO_LIST_YOY': 'avg_sale_to_list_ratio_yoy_pct',
        'SOLD_ABOVE_LIST': 'sold_above_list', 'SOLD_ABOVE_LIST_MOM': 'sold_above_list_mom_pct', 'SOLD_ABOVE_LIST_YOY': 'sold_above_list_yoy_pct',
        'PRICE_DROPS': 'price_drops', 'PRICE_DROPS_MOM': 'price_drops_mom_pct', 'PRICE_DROPS_YOY': 'price_drops_yoy_pct',
        'OFF_MARKET_IN_TWO_WEEKS': 'off_market_in_two_weeks', 'OFF_MARKET_IN_TWO_WEEKS_MOM': 'off_market_in_two_weeks_mom_pct', 'OFF_MARKET_IN_TWO_WEEKS_YOY': 'off_market_in_two_weeks_yoy_pct'
    }

def process_chunk(chunk_df, column_mapping):
    """Processes a single chunk of Redfin data."""
    available_cols = {k: v for k, v in column_mapping.items() if k in chunk_df.columns}
    chunk_df.rename(columns=available_cols, inplace=True)
    chunk_df['zip_code'] = chunk_df['REGION'].apply(extract_zip_code)
    chunk_df = chunk_df.dropna(subset=['zip_code'])
    chunk_df['period_end'] = pd.to_datetime(chunk_df['period_end'])
    final_cols = list(column_mapping.values()) + ['zip_code']
    existing_cols = [col for col in final_cols if col in chunk_df.columns]
    return chunk_df[existing_cols]

def format_final_json(df, zip_mapping):
    """Formats the data for JSON output with a specific, logical key order."""
    result = {}
    key_order = [
        'city', 'county', 'state', 'parent_metro', 'latitude', 'longitude', 'period_end',
        'median_sale_price', 'median_sale_price_mom_pct', 'median_sale_price_yoy_pct',
        'median_list_price', 'median_list_price_mom_pct', 'median_list_price_yoy_pct',
        'median_ppsf', 'median_ppsf_mom_pct', 'median_ppsf_yoy_pct',
        'homes_sold', 'homes_sold_mom_pct', 'homes_sold_yoy_pct',
        'pending_sales', 'pending_sales_mom_pct', 'pending_sales_yoy_pct',
        'new_listings', 'new_listings_mom_pct', 'new_listings_yoy_pct',
        'inventory', 'inventory_mom_pct', 'inventory_yoy_pct',
        'median_dom', 'median_dom_mom_pct', 'median_dom_yoy_pct',
        'avg_sale_to_list_ratio', 'avg_sale_to_list_mom_pct', 'avg_sale_to_list_ratio_yoy_pct',
        'sold_above_list', 'sold_above_list_mom_pct', 'sold_above_list_yoy_pct',
        'off_market_in_two_weeks', 'off_market_in_two_weeks_mom_pct', 'off_market_in_two_weeks_yoy_pct'
    ]
    for _, row in df.iterrows():
        zip_code = row['zip_code']
        raw_data = row.to_dict()
        if zip_mapping and zip_code in zip_mapping:
            raw_data['city'] = zip_mapping[zip_code].get('City')
            raw_data['county'] = zip_mapping[zip_code].get('CountyName')
            raw_data['latitude'] = zip_mapping[zip_code].get('latitude')
            raw_data['longitude'] = zip_mapping[zip_code].get('longitude')
        
        ordered_data = {}
        for key in key_order:
            if key in raw_data:
                value = raw_data[key]
                if pd.isna(value): ordered_data[key] = None
                elif isinstance(value, pd.Timestamp): ordered_data[key] = value.strftime('%Y-%m-%d')
                elif key in ['latitude', 'longitude']: ordered_data[key] = round(float(value), 5) if not pd.isna(value) else None
                elif 'pct' in key: ordered_data[key] = round(float(value) * 100, 1) if not pd.isna(value) else None
                elif any(c in key for c in ['price', 'homes_sold', 'inventory', 'dom']): ordered_data[key] = int(float(value)) if not pd.isna(value) else None
                elif isinstance(value, float): ordered_data[key] = round(value, 2) if not pd.isna(value) else None
                else: ordered_data[key] = value
        result[zip_code] = ordered_data
    return result

def main():
    zip_mapping = load_zip_mapping_data()
    if zip_mapping is None: exit(1)

    url = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz"
    data = download_redfin_data(url)
    if data is None: exit(1)
    
    try:
        column_mapping = get_full_column_mapping()
        buffer = BytesIO(data)
        chunk_iterator = pd.read_csv(gzip.GzipFile(fileobj=buffer), sep='\t', chunksize=100000)
        processed_chunks = [process_chunk(chunk, column_mapping) for chunk in chunk_iterator]
        df_full = pd.concat(processed_chunks, ignore_index=True)
        df_latest = df_full.sort_values('period_end').groupby('zip_code').tail(1)
        
        output_data_content = format_final_json(df_latest, zip_mapping)
        final_output = {
            "last_updated_utc": datetime.now(timezone.utc).isoformat(),
            "zip_codes": output_data_content
        }
        
        output_dir = Path("public/data")
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / "zip-data.json.gz"
        json_string = json.dumps(final_output)
        compressed_json = gzip.compress(json_string.encode('utf-8'))
        with open(output_file, 'wb') as f: f.write(compressed_json)
        
        logging.info(f"Successfully wrote {len(output_data_content)} ZIP codes to {output_file}")

        if output_data_content:
            sample_zip = random.choice(list(output_data_content.keys()))
            pretty_sample = json.dumps({sample_zip: output_data_content[sample_zip]}, indent=2)
            print("\n--- Verification Sample ---"); print(pretty_sample); print("-------------------------")
            logging.info(f"Verification sample for ZIP {sample_zip}:\n{pretty_sample}")
            
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        raise

if __name__ == "__main__":
    main()