#!/usr/bin/env python3
"""
Redfin ZIP Code Data Parser
Downloads and processes Redfin housing market data for ZIP codes.
"""

import pandas as pd
import requests
import gzip
import json
import os
import re
from datetime import datetime
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(filename='data_pipeline.log', level=logging.ERROR)

# --- REPLACE your original download_redfin_data with this ---
def download_redfin_data_to_file(url, dest_path, timeout=300):
    """Download large file in streaming mode and save to disk."""
    try:
        print(f"Downloading data from {url} ...")
        with requests.get(url, stream=True, timeout=timeout) as r:
            r.raise_for_status()
            with open(dest_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
        print(f"Download finished: {dest_path}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Error downloading data: {e}")
        return False

# Keep your extract_zip_code, clean_and_convert_data, format_data_for_output functions as is

def extract_zip_code(region_str):
    """Extract ZIP code from REGION column."""
    if pd.isna(region_str) or not region_str:
        return None
    
    # Match pattern "Zip Code: 12345"
    match = re.search(r'Zip Code:\s*(\d{5})', str(region_str))
    if match:
        return match.group(1)
    return None

def clean_and_convert_data(df):
    """Clean and convert the dataframe to the desired format."""
    # Extract ZIP codes
    df['zip_code'] = df['REGION'].apply(extract_zip_code)
    
    # Filter out rows without valid ZIP codes
    df = df.dropna(subset=['zip_code'])
    
    # Convert PERIOD_END to datetime for sorting
    df['PERIOD_END'] = pd.to_datetime(df['PERIOD_END'])
    
    # Keep only the latest period per ZIP code
    df = df.sort_values('PERIOD_END').groupby('zip_code').tail(1)
    
    # Column mapping for renaming
    column_mapping = {
        'STATE': 'state',
        'CITY': 'city', 
        'PROPERTY_TYPE': 'property_type',
        'PERIOD_END': 'period_end',
        'IS_SEASONALLY_ADJUSTED': 'seasonally_adjusted',
        'MEDIAN_SALE_PRICE': 'median_sale_price',
        'MEDIAN_SALE_PRICE_MOM': 'median_sale_price_mom_pct',
        'MEDIAN_SALE_PRICE_YOY': 'median_sale_price_yoy_pct',
        'MEDIAN_LIST_PRICE': 'median_list_price',
        'MEDIAN_LIST_PRICE_MOM': 'median_list_price_mom_pct',
        'MEDIAN_LIST_PRICE_YOY': 'median_list_price_yoy_pct',
        'MEDIAN_PPSF': 'median_ppsf',
        'MEDIAN_PPSF_MOM': 'median_ppsf_mom_pct',
        'MEDIAN_PPSF_YOY': 'median_ppsf_yoy_pct',
        'MEDIAN_LIST_PPSF': 'median_list_ppsf',
        'MEDIAN_LIST_PPSF_MOM': 'median_list_ppsf_mom_pct',
        'MEDIAN_LIST_PPSF_YOY': 'median_list_ppsf_yoy_pct',
        'HOMES_SOLD': 'homes_sold',
        'HOMES_SOLD_MOM': 'homes_sold_mom_pct',
        'HOMES_SOLD_YOY': 'homes_sold_yoy_pct',
        'PENDING_SALES': 'pending_sales',
        'PENDING_SALES_MOM': 'pending_sales_mom_pct',
        'PENDING_SALES_YOY': 'pending_sales_yoy_pct',
        'NEW_LISTINGS': 'new_listings',
        'NEW_LISTINGS_MOM': 'new_listings_mom_pct',
        'NEW_LISTINGS_YOY': 'new_listings_yoy_pct',
        'INVENTORY': 'inventory',
        'INVENTORY_MOM': 'inventory_mom_pct',
        'INVENTORY_YOY': 'inventory_yoy_pct',
        'MONTHS_OF_SUPPLY': 'months_of_supply',
        'MONTHS_OF_SUPPLY_MOM': 'months_of_supply_mom_pct',
        'MONTHS_OF_SUPPLY_YOY': 'months_of_supply_yoy_pct',
        'MEDIAN_DOM': 'median_dom',
        'MEDIAN_DOM_MOM': 'median_dom_mom_pct',
        'MEDIAN_DOM_YOY': 'median_dom_yoy_pct',
        'AVG_SALE_TO_LIST': 'avg_sale_to_list_ratio',
        'AVG_SALE_TO_LIST_MOM': 'avg_sale_to_list_mom_pct',
        'AVG_SALE_TO_LIST_YOY': 'avg_sale_to_list_yoy_pct',
        'SOLD_ABOVE_LIST': 'sold_above_list',
        'SOLD_ABOVE_LIST_MOM': 'sold_above_list_mom_pct',
        'SOLD_ABOVE_LIST_YOY': 'sold_above_list_yoy_pct',
        'PRICE_DROPS': 'price_drops',
        'PRICE_DROPS_MOM': 'price_drops_mom_pct',
        'PRICE_DROPS_YOY': 'price_drops_yoy_pct',
        'OFF_MARKET_IN_TWO_WEEKS': 'off_market_in_two_weeks',
        'OFF_MARKET_IN_TWO_WEEKS_MOM': 'off_market_in_two_weeks_mom_pct',
        'OFF_MARKET_IN_TWO_WEEKS_YOY': 'off_market_in_two_weeks_yoy_pct',
        'PARENT_METRO_REGION': 'parent_metro'
    }
    
    # Select and rename columns
    available_columns = [col for col in column_mapping.keys() if col in df.columns]
    df_clean = df[available_columns + ['zip_code']].copy()
    df_clean = df_clean.rename(columns=column_mapping)
    
    return df_clean

def format_data_for_output(df):
    """Format the data for JSON output with proper rounding and data types."""
    result = {}
    
    for _, row in df.iterrows():
        zip_code = row['zip_code']
        data = {}
        
        for column, value in row.items():
            if column == 'zip_code':
                continue
                
            if pd.isna(value):
                data[column] = None
            elif column == 'period_end':
                data[column] = value.strftime('%Y-%m-%d')
            elif column in ['seasonally_adjusted']:
                data[column] = bool(value)
            elif column in ['state', 'city', 'property_type', 'parent_metro']:
                data[column] = str(value) if not pd.isna(value) else None
            elif 'pct' in column:
                # Convert to percentage and round to 1 decimal
                data[column] = round(float(value) * 100, 1) if not pd.isna(value) else None
            elif column in ['median_sale_price', 'median_list_price']:
                # Prices as whole numbers
                data[column] = int(float(value)) if not pd.isna(value) else None
            elif column in ['median_ppsf', 'median_list_ppsf', 'avg_sale_to_list_ratio']:
                # Ratios and PPSF to 2 decimals
                data[column] = round(float(value), 2) if not pd.isna(value) else None
            elif column in ['homes_sold', 'inventory', 'new_listings', 'sold_above_list', 'pending_sales']:
                # Counts as whole numbers
                data[column] = int(float(value)) if not pd.isna(value) else None
            else:
                # Default: preserve as float with 2 decimals
                try:
                    data[column] = round(float(value), 2) if not pd.isna(value) else None
                except (ValueError, TypeError):
                    data[column] = value
        
        result[zip_code] = data
    
    return result

def main():
    """Main processing function."""
    url = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz"
    temp_file = "zip_code_market_tracker.tsv000.gz"
    
    output_dir = Path("public/data")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "zip_data.json"
    
    # Flag to decide if update needed
    need_update = False
    if not output_file.exists():
        need_update = True
    
    # Step 1: If zip_data.json does NOT exist, must generate
    if not output_file.exists():
        print(f"{output_file} does not exist. Will generate new data.")
        need_update = True
    else:
        print(f"{output_file} exists. Will download and compare for changes.")
        need_update = True  # We still download and compare later
    
    if need_update:
        # Download data to file
        success = download_redfin_data_to_file(url, temp_file)
        if not success:
            print("Failed to download data. Exiting gracefully.")
            return
        
        try:
            print("Decompressing and parsing data from file...")
            with gzip.open(temp_file, 'rt', encoding='utf-8') as f:
                df = pd.read_csv(f, sep='\t')
            
            print(f"Loaded {len(df)} rows from Redfin data")
            
            df_clean = clean_and_convert_data(df)
            print(f"Processed {len(df_clean)} ZIP codes")
            
            output_data = format_data_for_output(df_clean)
            
            # Compare with existing file if it exists
            if output_file.exists():
                with open(output_file, 'r') as f_existing:
                    existing_data = json.load(f_existing)
                
                if existing_data == output_data:
                    print("No changes detected compared to existing zip_data.json. Skipping overwrite.")
                else:
                    with open(output_file, 'w') as f_out:
                        json.dump(output_data, f_out, indent=2)
                    print(f"Data updated and written to {output_file}")
            else:
                # File did not exist, so write it
                with open(output_file, 'w') as f_out:
                    json.dump(output_data, f_out, indent=2)
                print(f"Successfully wrote new data to {output_file}")
            
            if output_data:
                sample_zip = list(output_data.keys())[0]
                print(f"\nSample data for ZIP {sample_zip}:")
                print(json.dumps({sample_zip: output_data[sample_zip]}, indent=2))
        except Exception as e:
            logging.error(f"Error processing data: {e}")
            print(f"Error processing data: {e}")
            raise
        finally:
            # Clean up the large downloaded file after processing
            if os.path.exists(temp_file):
                os.remove(temp_file)

if __name__ == "__main__":
    main()
