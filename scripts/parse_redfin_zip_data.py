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

# Configure logging
logging.basicConfig(filename='data_pipeline.log', filemode='w', level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
ROOT_DIR = Path(__file__).resolve().parent.parent       # /.../Domapus
DATA_DIR = ROOT_DIR / "public" / "data"

def load_zip_mapping_data(file_path=None):
    """Loads the pre-cleaned ZIP to city, county, metro and coordinate mapping file."""
    try:
        if file_path is None:
            file_path = DATA_DIR / "zcta-meta.csv"

        logging.info(f"Loading ZIP mapping data from {file_path}...")
        
        # CHANGED: Updated dtype and index to match the 'zcta' header from your snippet
        df = pd.read_csv(file_path, dtype={'zcta': str})
        df.set_index('zcta', inplace=True)
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
            logging.info(f"Successfully downloaded data (attempt {attempt}).")
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
        'STATE': 'redfin_state', # Renamed to avoid conflict with CSV state, though we usually prefer CSV
        'PARENT_METRO_REGION': 'redfin_metro', # Renamed to prioritize CSV metro
        'PERIOD_END': 'period_end',
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
    # Find which columns from the mapping are actually in this chunk
    available_cols = {k: v for k, v in column_mapping.items() if k in chunk_df.columns}
    chunk_df.rename(columns=available_cols, inplace=True)
    
    # Extract ZIP code
    chunk_df['zip_code'] = chunk_df['REGION'].apply(extract_zip_code)
    chunk_df = chunk_df.dropna(subset=['zip_code'])
    
    # Convert date
    chunk_df['period_end'] = pd.to_datetime(chunk_df['period_end'])
    
    # Filter to only the columns we care about
    final_cols = list(column_mapping.values()) + ['zip_code']
    existing_cols = [col for col in final_cols if col in chunk_df.columns]
    return chunk_df[existing_cols]

def format_final_json(df, zip_mapping):
    """Formats the data for JSON output with a specific, logical key order."""
    result = {}
    # Define the desired order of keys in the final JSON object
    key_order = [
        'city', 'county', 'state', 'metro', 'latitude', 'longitude', 'period_end',
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
        
        # Add data from the ZIP code mapping (CSV)
        # CHANGED: Updated keys to match the CSV headers (zcta,state,metro,county,city,lat,lng)
        if zip_mapping and zip_code in zip_mapping:
            zip_info = zip_mapping[zip_code]
            raw_data['city'] = zip_info.get('city')
            raw_data['county'] = zip_info.get('county')
            raw_data['state'] = zip_info.get('state')  # Overwrites Redfin state with CSV state
            raw_data['metro'] = zip_info.get('metro')  # Uses CSV metro
            raw_data['latitude'] = zip_info.get('lat')
            raw_data['longitude'] = zip_info.get('lng')
        
        ordered_data = {}
        for key in key_order:
            if key in raw_data:
                value = raw_data[key]
                # Standardize data types and formats
                if pd.isna(value) or value == "": 
                    ordered_data[key] = None
                elif isinstance(value, pd.Timestamp): 
                    ordered_data[key] = value.strftime('%Y-%m-%d')
                elif key in ['latitude', 'longitude']: 
                    ordered_data[key] = round(float(value), 5) if not pd.isna(value) else None
                elif 'pct' in key or key in ['sold_above_list', 'off_market_in_two_weeks']: 
                    # Convert ratios (0.05) to percentages (5.0)
                    ordered_data[key] = round(float(value) * 100, 1) if not pd.isna(value) else None
                elif any(c in key for c in ['price', 'homes_sold', 'inventory', 'dom', 'ppsf', 'listings', 'pending']): 
                    ordered_data[key] = int(float(value)) if not pd.isna(value) else None
                elif isinstance(value, float): 
                    ordered_data[key] = round(value, 2) if not pd.isna(value) else None
                else: 
                    ordered_data[key] = value
            else:
                ordered_data[key] = None
                    
        result[zip_code] = ordered_data
    return result

def main():
    logging.info("--- Starting Data Pipeline Run ---")
    zip_mapping = load_zip_mapping_data()
    if zip_mapping is None: 
        logging.critical("Failed to load ZIP mapping. Exiting.")
        exit(1)

    url = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz"
    data = download_redfin_data(url)
    if data is None: 
        logging.critical("Failed to download Redfin data. Exiting.")
        exit(1)
    
    try:
        logging.info("Processing downloaded data...")
        column_mapping = get_full_column_mapping()
        buffer = BytesIO(data)
        chunk_iterator = pd.read_csv(gzip.GzipFile(fileobj=buffer), sep='\t', chunksize=100000)
        
        processed_chunks = [process_chunk(chunk, column_mapping) for chunk in chunk_iterator]
        df_full = pd.concat(processed_chunks, ignore_index=True)
        
        # Get only the latest entry for each ZIP code
        df_latest = df_full.sort_values('period_end').groupby('zip_code').tail(1)
        logging.info(f"Processed data. Found {len(df_latest)} unique ZIP codes with latest data.")
        
        output_data_content = format_final_json(df_latest, zip_mapping)

        final_output = {
            "zip_codes": output_data_content
        }
        
        output_dir = Path("public/data")
        output_dir.mkdir(parents=True, exist_ok=True)

        # Load previous data from plain JSON
        previous_data = None
        zip_data_path = output_dir / "zip-data.json"
        try:
            if zip_data_path.exists():
                logging.info(f"Loading previous data from {zip_data_path} for comparison...")
                with open(zip_data_path, 'r', encoding='utf-8') as f:
                    previous_data = json.load(f).get('zip_codes', {})
                logging.info("Successfully loaded previous data.")
        except Exception as e:
            logging.warning(f"Could not load previous data for comparison: {e}")

        # Calculate changes
        zip_codes_changed = 0
        data_points_changed = 0
        
        if previous_data:
            new_zips = set(output_data_content.keys())
            old_zips = set(previous_data.keys())
            
            # Count new or removed ZIP codes
            zip_codes_changed = len(new_zips ^ old_zips)
            
            # Count changed data points in existing ZIP codes
            for zip_code in new_zips & old_zips:
                new_data = output_data_content[zip_code]
                old_data = previous_data[zip_code]
                
                for key in new_data:
                    # Check if key exists in old data and if values are different
                    if key in old_data and new_data[key] != old_data[key]:
                        data_points_changed += 1
                    # Count if key is new for this zip_code
                    elif key not in old_data:
                        data_points_changed += 1
            logging.info(f"Comparison complete: {zip_codes_changed} ZIPs added/removed, {data_points_changed} data points changed.")
        else:
            logging.info("No previous data found. Skipping comparison.")

        # Write output to plain JSON
        logging.info(f"Writing {len(output_data_content)} ZIP codes to {zip_data_path}...")
        # Use separators for compact JSON
        json_string = json.dumps(final_output, sort_keys=True, separators=(",", ":"))
        
        with open(zip_data_path, 'w', encoding='utf-8') as f:
            f.write(json_string)
            f.flush()

        # Write last_updated.json with change statistics
        update_info = {
            "last_updated_utc": datetime.now(timezone.utc).isoformat(),
            "total_zip_codes": len(output_data_content),
            "zip_codes_changed": zip_codes_changed,
            "data_points_changed": data_points_changed
        }
        
        last_updated_path = output_dir / "last_updated.json"
        with open(last_updated_path, 'w') as f:
            json.dump(update_info, f, indent=2)
            f.flush()
        logging.info(f"Successfully wrote update stats to {last_updated_path}")
            
    except Exception as e:
        logging.error(f"An error occurred during the main processing block: {e}")
        logging.error("--- Data Pipeline Run FAILED ---")
        raise


if __name__ == "__main__":
    main()