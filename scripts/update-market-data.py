import pandas as pd
import requests
import gzip
import json
import re
import logging
import sys
import random
from datetime import datetime, timezone
from pathlib import Path
from io import BytesIO

# --- Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s',
    handlers=[logging.FileHandler('data_pipeline.log', 'w'), logging.StreamHandler()]
)

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "public" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

def load_zip_mapping_data(file_path=None):
    file_path = file_path or DATA_DIR / "zcta-meta.csv"
    try:
        logging.info(f"Loading ZIP mapping from {file_path}...")
        df = pd.read_csv(file_path, dtype={'zcta': str})
        df.set_index('zcta', inplace=True)
        return df.to_dict('index')
    except Exception as e:
        logging.error(f"CRITICAL ERROR loading mapping: {e}")
        return None

def download_file(url, label, save_path=None, timeout=300):
    try:
        logging.info(f"Downloading {label}...")
        if save_path:
            Path(save_path).parent.mkdir(parents=True, exist_ok=True)
            with requests.get(url, stream=True, timeout=timeout) as r:
                r.raise_for_status()
                with open(save_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=65536):
                        f.write(chunk)
            return True
        else:
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            return response.content
    except Exception as e:
        logging.warning(f"Download {label} failed (Link likely changed/invalid): {e}")
        return None

def process_zillow_data(content):
    try:
        logging.info("Processing Zillow ZHVI data...")
        df = pd.read_csv(BytesIO(content), dtype={'RegionName': str})
        date_cols = sorted([c for c in df.columns if re.match(r'\d{4}-\d{2}-\d{2}', c)])
        
        if len(date_cols) < 13:
            logging.error("Insufficient Zillow history.")
            return {}

        curr, mom, yoy = date_cols[-1], date_cols[-2], date_cols[-13]
        zillow_results = {}
        
        for _, row in df.iterrows():
            zip_code = row['RegionName'].zfill(5)
            val = row[curr]
            val_mom = row[mom]
            val_yoy = row[yoy]
            
            if pd.isna(val): continue
            
            zillow_results[zip_code] = {
                'zhvi': round(float(val), 2),
                'zhvi_mom': round(((val / val_mom) - 1), 3) if val_mom and val_mom != 0 else None,
                'zhvi_yoy': round(((val / val_yoy) - 1), 3) if val_yoy and val_yoy != 0 else None
            }
        return zillow_results
    except Exception as e:
        logging.error(f"Zillow processing error: {e}")
        return {}

def extract_zip_code(region_str):
    if pd.isna(region_str): return None
    match = re.search(r'Zip Code:\s*(\d{5})', str(region_str))
    return match.group(1) if match else None

def get_full_column_mapping():
    return {
        'PERIOD_END': 'period_end',
        'MEDIAN_SALE_PRICE': 'median_sale_price', 'MEDIAN_SALE_PRICE_MOM': 'median_sale_price_mom', 'MEDIAN_SALE_PRICE_YOY': 'median_sale_price_yoy',
        'MEDIAN_LIST_PRICE': 'median_list_price', 'MEDIAN_LIST_PRICE_MOM': 'median_list_price_mom', 'MEDIAN_LIST_PRICE_YOY': 'median_list_price_yoy',
        'MEDIAN_PPSF': 'median_ppsf', 'MEDIAN_PPSF_MOM': 'median_ppsf_mom', 'MEDIAN_PPSF_YOY': 'median_ppsf_yoy',
        'HOMES_SOLD': 'homes_sold', 'HOMES_SOLD_MOM': 'homes_sold_mom', 'HOMES_SOLD_YOY': 'homes_sold_yoy',
        'PENDING_SALES': 'pending_sales', 'PENDING_SALES_MOM': 'pending_sales_mom', 'PENDING_SALES_YOY': 'pending_sales_yoy',
        'NEW_LISTINGS': 'new_listings', 'NEW_LISTINGS_MOM': 'new_listings_mom', 'NEW_LISTINGS_YOY': 'new_listings_yoy',
        'INVENTORY': 'inventory', 'INVENTORY_MOM': 'inventory_mom', 'INVENTORY_YOY': 'inventory_yoy',
        'MEDIAN_DOM': 'median_dom', 'MEDIAN_DOM_MOM': 'median_dom_mom', 'MEDIAN_DOM_YOY': 'median_dom_yoy',
        'AVG_SALE_TO_LIST': 'avg_sale_to_list_ratio', 'AVG_SALE_TO_LIST_MOM': 'avg_sale_to_list_mom', 'AVG_SALE_TO_LIST_YOY': 'avg_sale_to_list_ratio_yoy',
        'SOLD_ABOVE_LIST': 'sold_above_list', 'SOLD_ABOVE_LIST_MOM': 'sold_above_list_mom', 'SOLD_ABOVE_LIST_YOY': 'sold_above_list_yoy',
        'OFF_MARKET_IN_TWO_WEEKS': 'off_market_in_two_weeks', 'OFF_MARKET_IN_TWO_WEEKS_MOM': 'off_market_in_two_weeks_mom', 'OFF_MARKET_IN_TWO_WEEKS_YOY': 'off_market_in_two_weeks_yoy'
    }

def main():
    logging.info("--- Starting Data Pipeline Run ---")
    zip_mapping = load_zip_mapping_data()
    if not zip_mapping: 
        logging.error("Mapping data not found. Exiting.")
        return

    # 1. Zillow Integration
    zillow_url = "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv"
    zillow_content = download_file(zillow_url, "Zillow")
    if zillow_content is None:
        logging.info("Link invalid. Exiting gracefully with success.")
        sys.exit(0)
    
    zillow_data = process_zillow_data(zillow_content)

    # 2. Redfin Integration
    redfin_url = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz"
    temp_redfin_file = DATA_DIR / "redfin_temp.tsv.gz"
    
    success = download_file(redfin_url, "Redfin", save_path=temp_redfin_file)
    if not success:
        logging.info("Link invalid. Exiting gracefully with success.")
        sys.exit(0)

    col_map = get_full_column_mapping()
    latest_records = {} 

    try:
        with gzip.open(temp_redfin_file, 'rt') as f:
            use_cols = list(col_map.keys()) + ['REGION']
            reader = pd.read_csv(f, sep='\t', chunksize=100000, usecols=use_cols)
            for chunk in reader:
                chunk['zip_code'] = chunk['REGION'].apply(extract_zip_code)
                chunk = chunk.dropna(subset=['zip_code'])
                chunk['PERIOD_END'] = pd.to_datetime(chunk['PERIOD_END'])
                
                for _, row in chunk.iterrows():
                    z = row['zip_code']
                    if z not in latest_records or row['PERIOD_END'] > latest_records[z]['PERIOD_END']:
                        latest_records[z] = row.to_dict()
        
        if temp_redfin_file.exists():
            temp_redfin_file.unlink()

        # 3. Final Assembly
        output_data = {}
        max_period_end = None  # To track the latest date found in the data

        key_order = [
            'city', 'county', 'state', 'metro', 'lat', 'lng', 'period_end',
            'zhvi', 'zhvi_mom', 'zhvi_yoy',
            'median_sale_price', 'median_sale_price_mom', 'median_sale_price_yoy',
            'median_list_price', 'median_list_price_mom', 'median_list_price_yoy',
            'median_ppsf', 'median_ppsf_mom', 'median_ppsf_yoy',
            'homes_sold', 'homes_sold_mom', 'homes_sold_yoy',
            'pending_sales', 'pending_sales_mom', 'pending_sales_yoy',
            'new_listings', 'new_listings_mom', 'new_listings_yoy',
            'inventory', 'inventory_mom', 'inventory_yoy',
            'median_dom', 'median_dom_mom', 'median_dom_yoy',
            'avg_sale_to_list_ratio', 'avg_sale_to_list_mom', 'avg_sale_to_list_ratio_yoy',
            'sold_above_list', 'sold_above_list_mom', 'sold_above_list_yoy',
            'off_market_in_two_weeks', 'off_market_in_two_weeks_mom', 'off_market_in_two_weeks_yoy'
        ]

        for zip_code, zm in zip_mapping.items():
            raw_data = {
                'city': zm.get('city'), 
                'county': zm.get('county'), 
                'state': zm.get('state'), 
                'metro': zm.get('metro'), 
                'lat': zm.get('lat'), 
                'lng': zm.get('lng')
            }
            
            redfin_dict = latest_records.get(zip_code, {})
            if redfin_dict:
                redfin_mapped = {col_map.get(k, k): v for k, v in redfin_dict.items()}
                raw_data.update(redfin_mapped)
            
            if zip_code in zillow_data:
                raw_data.update(zillow_data[zip_code])
            
            ordered_data = {}
            for key in key_order:
                val = raw_data.get(key)
                
                if val is None or pd.isna(val) or val == "": 
                    ordered_data[key] = None
                    continue

                try:
                    if key == 'period_end':
                        formatted_date = val.strftime('%Y-%m-%d') if hasattr(val, 'strftime') else str(val)[:10]
                        ordered_data[key] = formatted_date
                        # Track the overall latest period_end
                        if max_period_end is None or formatted_date > max_period_end:
                            max_period_end = formatted_date
                            
                    elif key in ['lat', 'lng']:
                        ordered_data[key] = round(float(val), 5)
                    elif key == 'median_ppsf':
                        ordered_data[key] = round(float(val), 2)
                    elif key == 'avg_sale_to_list_ratio':
                        ordered_data[key] = round(float(val) * 100, 1)
                    elif any(x in key for x in ['_mom', '_yoy', 'sold_above_list', 'off_market_in_two_weeks']):
                        if 'dom' in key:
                            ordered_data[key] = round(float(val), 1)
                        else:
                            ordered_data[key] = round(float(val) * 100, 1)
                    elif any(c in key for c in ['price', 'sold', 'inventory', 'dom', 'listings', 'pending', 'zhvi']):
                        ordered_data[key] = int(float(val))
                    else:
                        ordered_data[key] = val
                except (ValueError, TypeError):
                    ordered_data[key] = None
            
            output_data[zip_code] = ordered_data

        # 4. Save and Compare
        zip_data_path = DATA_DIR / "zip-data.json"
        zip_codes_changed = 0
        data_points_changed = 0
        old_timestamp = None

        if output_data:
            random_zip = random.choice(list(output_data.keys()))
            logging.info(f"VERIFICATION - Random ZIP Data ({random_zip}): {json.dumps(output_data[random_zip], indent=2)}")
        
        if zip_data_path.exists():
            try:
                with open(zip_data_path, 'r') as f:
                    old_payload = json.load(f)
                    
                # Preserve the old timestamp
                old_timestamp = old_payload.get('last_updated_utc')
                    
                # Handle both old keyed format and new columnar format
                if 'zip_codes' in old_payload:
                    # Old keyed format
                    old_data = old_payload['zip_codes']
                elif 'f' in old_payload and 'z' in old_payload and 'd' in old_payload:
                    # New columnar format - reconstruct for comparison
                    fields = old_payload['f']
                    zip_codes = old_payload['z']
                    rows = old_payload['d']
                    old_data = {}
                    for i, z in enumerate(zip_codes):
                        old_data[z] = {fields[j]: rows[i][j] for j in range(len(fields))}
                else:
                    old_data = {}
                    
                new_zips = set(output_data.keys())
                old_zips = set(old_data.keys())
                changed_zips_set = new_zips ^ old_zips
                common_zips = new_zips & old_zips
                
                for z in common_zips:
                    if output_data[z] != old_data[z]:
                        changed_zips_set.add(z)
                        
                        for k, v in output_data[z].items():
                            if v != old_data[z].get(k):
                                data_points_changed += 1
                
                zip_codes_changed = len(changed_zips_set)

            except Exception as e:
                logging.warning(f"Comparison failed: {e}")

        # Convert to columnar format
        zip_list = []
        data_rows = []
        
        for zip_code in sorted(output_data.keys()):
            zip_list.append(zip_code)
            row = [output_data[zip_code].get(field) for field in key_order]
            data_rows.append(row)
        
        # Use current timestamp if this is a new file or if data changed
        current_timestamp = datetime.now(timezone.utc).isoformat()
        timestamp_to_use = current_timestamp if (old_timestamp is None or zip_codes_changed > 0 or data_points_changed > 0) else old_timestamp
        
        columnar_output = {
            "last_updated_utc": timestamp_to_use,
            "f": key_order,
            "z": zip_list,
            "d": data_rows
        }
        
        with open(zip_data_path, 'w', encoding='utf-8') as f:
            json.dump(columnar_output, f, separators=(",", ":"))

        with open(DATA_DIR / "last_updated.json", 'w') as f:
            json.dump({
                "last_updated_utc": datetime.now(timezone.utc).isoformat(),
                "period_end": max_period_end,
                "total_zip_codes": len(output_data),
                "zip_codes_changed": zip_codes_changed,
                "data_points_changed": data_points_changed
            }, f, indent=2)

        logging.info(f"Run completed. Processed {len(output_data)} ZIP codes.")

    except Exception as e:
        logging.error(f"Pipeline failed: {e}")
        raise

if __name__ == "__main__":
    main()
