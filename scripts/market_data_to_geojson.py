import pandas as pd
import requests
import gzip
import json
import re
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from io import BytesIO

# Configure logging
logging.basicConfig(filename='data_pipeline.log', filemode='w', level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

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

def transform_value(key, value):
    """Formats values (percentages, integers, rounding) based on the key name."""
    if pd.isna(value):
        return None
    
    if isinstance(value, pd.Timestamp):
        return value.strftime('%Y-%m-%d')
    
    if 'pct' in key or key in ['sold_above_list', 'off_market_in_two_weeks']:
        # Convert ratios (0.05) to percentages (5.0)
        return round(float(value) * 100, 1)
    
    if any(c in key for c in ['homes_sold', 'inventory', 'dom', 'ppsf', 'listings', 'pending']):
        return int(float(value))
    
    if isinstance(value, float):
        return round(value, 2)
        
    return value

def load_previous_stats(output_path):
    """Loads the previous GeoJSON output to calculate change stats."""
    if not output_path.exists():
        return {}
    
    logging.info(f"Loading previous data from {output_path} for comparison...")
    try:
        with open(output_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Create a dict: { "zip_code": { property_dict } }
            return {
                f['properties']['zip_code']: f['properties'] 
                for f in data.get('features', []) 
                if 'zip_code' in f['properties']
            }
    except Exception as e:
        logging.warning(f"Could not load previous data: {e}")
        return {}

def main():
    logging.info("--- Starting Data Pipeline Run ---")

    # 1. Download Redfin Data
    url = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz"
    data = download_redfin_data(url)
    if data is None: 
        logging.critical("Failed to download Redfin data. Exiting.")
        exit(1)
    
    try:
        logging.info("Processing downloaded Redfin data...")
        column_mapping = get_full_column_mapping()
        buffer = BytesIO(data)
        
        chunk_iterator = pd.read_csv(gzip.GzipFile(fileobj=buffer), sep='\t', chunksize=100000)
        processed_chunks = [process_chunk(chunk, column_mapping) for chunk in chunk_iterator]
        df_full = pd.concat(processed_chunks, ignore_index=True)
        
        # Get latest entry per ZIP
        df_latest = df_full.sort_values('period_end').groupby('zip_code').tail(1)
        market_data_dict = df_latest.set_index('zip_code').to_dict('index')
        
        logging.info(f"Redfin data processed. Found {len(market_data_dict)} unique ZIP codes with market data.")

        # 2. Load Source GeoJSON (Geometry Source)
        source_path = Path("public/data/us-zip-codes.geojson.gz")
        logging.info(f"Loading source GeoJSON from {source_path}...")
        
        with gzip.open(source_path, 'r') as f:
            source_geojson = json.load(f)

        # 3. Load Previous Output for Stats
        output_dir = Path("public/data")
        output_path = output_dir / "zip-codes-master.geojson"
        previous_data_map = load_previous_stats(output_path)

        # 4. Merge and Calculate Stats
        key_order = [
            'zip_code', 'city', 'county', 'state', 'parent_metro', 'latitude', 'longitude', 'period_end',
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

        final_features = []
        data_points_changed = 0
        zip_codes_changed = 0 # Count of zips where content changed essentially (since geometry list is static from file)
        
        # We can detect if the set of ZIPs with DATA changed, or if values changed.
        # Since we drive from the GeoJSON list (which is static usually), we mostly track data updates.

        for feature in source_geojson['features']:
            props = feature['properties']
            zip_code = props.get('ZCTA5CE20')
            
            # -- Identity Data (From GeoJSON) --
            # Note: GeoJSON uses 'lat'/'lng', 'state', 'county', 'city'
            # Output requires 'latitude', 'longitude'
            
            lat = props.get('lat')
            lng = props.get('lng')
            
            # -- Market Data (From Redfin) --
            market_row = market_data_dict.get(zip_code, {})
            
            new_props = {}
            for key in key_order:
                # Identity mappings
                if key == 'zip_code': new_props[key] = zip_code
                elif key == 'city': new_props[key] = props.get('city')
                elif key == 'county': new_props[key] = props.get('county')
                elif key == 'state': new_props[key] = props.get('state')
                elif key == 'latitude': new_props[key] = round(float(lat), 5) if lat is not None else None
                elif key == 'longitude': new_props[key] = round(float(lng), 5) if lng is not None else None
                # Market data mappings
                else:
                    raw_val = market_row.get(key)
                    new_props[key] = transform_value(key, raw_val)
            
            # -- Statistics Comparison --
            if previous_data_map:
                old_props = previous_data_map.get(zip_code)
                if old_props:
                    # Compare specific market keys
                    changed_in_this_zip = False
                    for k, v in new_props.items():
                        # Simple equality check
                        if old_props.get(k) != v:
                            data_points_changed += 1
                            changed_in_this_zip = True
                    if changed_in_this_zip:
                        zip_codes_changed += 1
                else:
                    # New ZIP appeared in output (unlikely if driving from static geojson, but logic holds)
                    zip_codes_changed += 1
                    # Count non-null fields as "changed/new" data points
                    data_points_changed += sum(1 for v in new_props.values() if v is not None)

            # Assign new properties
            feature['properties'] = new_props
            final_features.append(feature)

        logging.info(f"Comparison complete: {zip_codes_changed} ZIPs updated, {data_points_changed} data points changed.")

        # 5. Write Output (One feature per line)
        logging.info(f"Writing {len(final_features)} features to {output_path}...")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('{"type": "FeatureCollection", "features": [\n')
            
            for i, feature in enumerate(final_features):
                # Dump feature with compact separators
                feature_str = json.dumps(feature, separators=(',', ':'))
                
                # Add comma if not the last item
                if i < len(final_features) - 1:
                    f.write(feature_str + ",\n")
                else:
                    f.write(feature_str + "\n")
                    
            f.write(']}')

        # 6. Write Statistics
        update_info = {
            "last_updated_utc": datetime.now(timezone.utc).isoformat(),
            "total_zip_codes": len(final_features),
            "zip_codes_with_market_data": len(market_data_dict),
            "zip_codes_changed": zip_codes_changed,
            "data_points_changed": data_points_changed
        }
        
        last_updated_path = output_dir / "last_updated.json"
        with open(last_updated_path, 'w') as f:
            json.dump(update_info, f, indent=2)
        
        logging.info(f"Successfully wrote update stats to {last_updated_path}")
        logging.info("--- Data Pipeline Run Finished Successfully ---")

    except Exception as e:
        logging.error(f"An error occurred during the main processing block: {e}")
        logging.error("--- Data Pipeline Run FAILED ---")
        raise

if __name__ == "__main__":
    main()