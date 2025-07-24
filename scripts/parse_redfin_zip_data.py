import pandas as pd
import requests
import gzip
import json
import random
import os
import re
from datetime import datetime
from pathlib import Path
import logging
from io import BytesIO

# --- Setup robust logging ---
logging.basicConfig(
     filename='data_pipeline.log',
     level=logging.INFO,
     format='%(asctime)s %(levelname)s %(message)s'
 )

def load_zip_mapping_data(file_path='public/data/zip-city-mapping.csv.gz'):
    """Loads the ZIP to city, county, and coordinate mapping file."""
    try:
        logging.info(f"Loading ZIP code mapping data from {file_path}...")
        df = pd.read_csv(file_path, compression='gzip', dtype={'ZipCode': str})
        df.drop_duplicates(subset=['ZipCode'], keep='first', inplace=True)
        df.set_index('ZipCode', inplace=True)
        logging.info(f"Successfully loaded {len(df)} unique mapping entries.")
        return df.to_dict('index')
    except Exception as e:
        logging.error(f"CRITICAL ERROR: Could not load or process {file_path}: {e}")
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
    """
    Defines the complete mapping from Redfin's TSV columns to our desired snake_case JSON keys.
    This acts as a "whitelist" for all the data we want to keep.
    """
    return {
        'STATE': 'state', 'PARENT_METRO_REGION': 'parent_metro',
        'PERIOD_END': 'period_end', 'MEDIAN_SALE_PRICE': 'median_sale_price', 'MEDIAN_SALE_PRICE_MOM': 'median_sale_price_mom_pct',
        'MEDIAN_SALE_PRICE_YOY': 'median_sale_price_yoy_pct', 'MEDIAN_LIST_PRICE': 'median_list_price', 'MEDIAN_LIST_PRICE_MOM': 'median_list_price_mom_pct',
        'MEDIAN_LIST_PRICE_YOY': 'median_list_price_yoy_pct', 'MEDIAN_PPSF': 'median_ppsf', 'MEDIAN_PPSF_MOM': 'median_ppsf_mom_pct',
        'MEDIAN_PPSF_YOY': 'median_ppsf_yoy_pct', 'MEDIAN_LIST_PPSF': 'median_list_ppsf', 'MEDIAN_LIST_PPSF_MOM': 'median_list_ppsf_mom_pct',
        'MEDIAN_LIST_PPSF_YOY': 'median_list_ppsf_yoy_pct', 'HOMES_SOLD': 'homes_sold', 'HOMES_SOLD_MOM': 'homes_sold_mom_pct',
        'HOMES_SOLD_YOY': 'homes_sold_yoy_pct', 'PENDING_SALES': 'pending_sales', 'PENDING_SALES_MOM': 'pending_sales_mom_pct',
        'PENDING_SALES_YOY': 'pending_sales_yoy_pct', 'NEW_LISTINGS': 'new_listings', 'NEW_LISTINGS_MOM': 'new_listings_mom_pct',
        'NEW_LISTINGS_YOY': 'new_listings_yoy_pct', 'INVENTORY': 'inventory', 'INVENTORY_MOM': 'inventory_mom_pct',
        'INVENTORY_YOY': 'inventory_yoy_pct', 'MONTHS_OF_SUPPLY': 'months_of_supply', 'MONTHS_OF_SUPPLY_MOM': 'months_of_supply_mom_pct',
        'MONTHS_OF_SUPPLY_YOY': 'months_of_supply_yoy_pct', 'MEDIAN_DOM': 'median_dom', 'MEDIAN_DOM_MOM': 'median_dom_mom_pct',
        'MEDIAN_DOM_YOY': 'median_dom_yoy_pct', 'AVG_SALE_TO_LIST': 'avg_sale_to_list_ratio', 'AVG_SALE_TO_LIST_MOM': 'avg_sale_to_list_mom_pct',
        'AVG_SALE_TO_LIST_YOY': 'avg_sale_to_list_ratio_yoy_pct', 'SOLD_ABOVE_LIST': 'sold_above_list', 'SOLD_ABOVE_LIST_MOM': 'sold_above_list_mom_pct',
        'SOLD_ABOVE_LIST_YOY': 'sold_above_list_yoy_pct', 'PRICE_DROPS': 'price_drops', 'PRICE_DROPS_MOM': 'price_drops_mom_pct',
        'PRICE_DROPS_YOY': 'price_drops_yoy_pct', 'OFF_MARKET_IN_TWO_WEEKS': 'off_market_in_two_weeks', 'OFF_MARKET_IN_TWO_WEEKS_MOM': 'off_market_in_two_weeks_mom_pct',
        'OFF_MARKET_IN_TWO_WEEKS_YOY': 'off_market_in_two_weeks_yoy_pct'
    }

def process_chunk(chunk_df, column_mapping):
    """Processes a single chunk of the Redfin data."""
    # Rename columns to our snake_case standard first
    available_cols_in_chunk = {k: v for k, v in column_mapping.items() if k in chunk_df.columns}
    chunk_df.rename(columns=available_cols_in_chunk, inplace=True)
    
    chunk_df['zip_code'] = chunk_df['REGION'].apply(extract_zip_code)
    chunk_df = chunk_df.dropna(subset=['zip_code'])
    chunk_df['period_end'] = pd.to_datetime(chunk_df['period_end'])
    
    # Keep only the columns we have explicitly whitelisted
    final_columns = list(column_mapping.values()) + ['zip_code']
    existing_final_columns = [col for col in final_columns if col in chunk_df.columns]
    
    return chunk_df[existing_final_columns]

def format_final_json(df, zip_mapping):
    """Formats the final, processed dataframe for JSON output."""
    result = {}
    
    for _, row in df.iterrows():
        zip_code = row['zip_code']
        # Start with the market data
        data = row.to_dict()
        data.pop('zip_code', None) # Remove zip_code from the inner object
        
        # Merge in the location data from the mapping file
        if zip_mapping and zip_code in zip_mapping:
            mapping_data = zip_mapping[zip_code]
            data['city'] = mapping_data.get('City')
            data['county'] = mapping_data.get('CountyName')
            data['latitude'] = mapping_data.get('latitude')
            data['longitude'] = mapping_data.get('longitude')
        else:
            data['city'], data['county'], data['latitude'], data['longitude'] = None, None, None, None
        
        # Final formatting for numbers and dates
        for column, value in data.items():
            if pd.isna(value): data[column] = None
            elif isinstance(value, pd.Timestamp): data[column] = value.strftime('%Y-%m-%d')
            elif 'pct' in column: data[column] = round(float(value) * 100, 1)
            elif any(c in column for c in ['price', 'homes_sold', 'inventory', 'dom', 'pending_sales']):
                data[column] = int(float(value))
            elif isinstance(value, float):
                data[column] = round(value, 2)
        
        result[zip_code] = data
    return result

def main():
    """Main processing function."""
    zip_mapping = load_zip_mapping_data()
    if zip_mapping is None:
        logging.critical("Exiting: zip-city-mapping data could not be loaded.")
        exit(1)

    url = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz"
    data = download_redfin_data(url)
    if data is None:
        logging.critical("Exiting: Failed to download Redfin data.")
        exit(1)
    
    try:
        column_mapping = get_full_column_mapping()
        
        logging.info("Decompressing and parsing data in memory-efficient chunks...")
        buffer = BytesIO(data)
        chunk_iterator = pd.read_csv(gzip.GzipFile(fileobj=buffer), sep='\t', chunksize=100000)
        
        processed_chunks = [process_chunk(chunk, column_mapping) for chunk in chunk_iterator]

        logging.info("All chunks processed. Concatenating results...")
        df_full = pd.concat(processed_chunks, ignore_index=True)

        logging.info("Getting the latest data for each ZIP code...")
        df_latest = df_full.sort_values('period_end').groupby('zip_code').tail(1)
        
        logging.info(f"Successfully processed {len(df_latest)} unique ZIP codes.")
        
        output_data = format_final_json(df_latest, zip_mapping)
        
        output_dir = Path("public/data")
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / "zip-data.json.gz"

        logging.info(f"Writing {len(output_data)} ZIP codes to {output_file}...")
        # Use no indent for the final file to save space
        json_string = json.dumps(output_data)
        compressed_json = gzip.compress(json_string.encode('utf-8'))
        with open(output_file, 'wb') as f:
            f.write(compressed_json)
        
        logging.info(f"Successfully wrote data to {output_file}")

        # --- FINAL VERIFICATION STEP ---
        if output_data:
            logging.info("\n--- Data Verification Step ---")
            
            # Pick a random ZIP code from the final dataset to inspect
            sample_zip = random.choice(list(output_data.keys()))
            sample_data = output_data[sample_zip]
            
            # Perform a sanity check
            if 'city' in sample_data and 'median_sale_price' in sample_data:
                logging.info("Sanity check PASSED: Sample data contains both merged location and market data.")
                
                # Print a clean, readable sample to the log and console
                pretty_sample = json.dumps({sample_zip: sample_data}, indent=2)
                print("\n--- Verification Sample ---")
                print(pretty_sample)
                print("-------------------------")
                logging.info(f"Verification sample for ZIP {sample_zip}:\n{pretty_sample}")
            else:
                logging.error("Sanity check FAILED: Sample data is missing critical merged fields.")
        else:
            logging.warning("Output data is empty. Cannot verify.")
        
    except Exception as e:
        logging.error(f"An error occurred during the main processing block: {e}")
        raise

if __name__ == "__main__":
    main()