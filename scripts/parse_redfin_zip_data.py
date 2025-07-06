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
from io import BytesIO  # >>> ADDED FOR STREAMED GZIP DECOMPRESSION
import random  # >>> ADDED FOR RANDOM SAMPLE

# Configure logging
logging.basicConfig(filename='data_pipeline.log', level=logging.ERROR)

def download_redfin_data(url, timeout=300, retries=3):
    """Download the Redfin data file with retries."""
    for attempt in range(1, retries + 1):
        try:
            print(f"Attempt {attempt}: Downloading data from {url}...")
            response = requests.get(url, timeout=timeout, stream=True)
            response.raise_for_status()
            return response.content
        except requests.exceptions.RequestException as e:
            print(f"Download failed (attempt {attempt}): {e}")
    print("All download attempts failed.")
    return None

def extract_zip_code(region_str):
    """Extract ZIP code from REGION column."""
    if pd.isna(region_str) or not region_str:
        return None
    match = re.search(r'Zip Code:\s*(\d{5})', str(region_str))
    if match:
        return match.group(1)
    return None

def clean_and_convert_data(df):
    """Clean and convert the dataframe to the desired format."""
    df['zip_code'] = df['REGION'].apply(extract_zip_code)
    df = df.dropna(subset=['zip_code'])
    df['PERIOD_END'] = pd.to_datetime(df['PERIOD_END'])
    df = df.sort_values('PERIOD_END').groupby('zip_code').tail(1)
    
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
                data[column] = round(float(value) * 100, 1) if not pd.isna(value) else None
            elif column in ['median_sale_price', 'median_list_price']:
                data[column] = int(float(value)) if not pd.isna(value) else None
            elif column in ['median_ppsf', 'median_list_ppsf', 'avg_sale_to_list_ratio']:
                data[column] = round(float(value), 2) if not pd.isna(value) else None
            elif column in ['homes_sold', 'inventory', 'new_listings', 'sold_above_list', 'pending_sales']:
                data[column] = int(float(value)) if not pd.isna(value) else None
            else:
                try:
                    data[column] = round(float(value), 2) if not pd.isna(value) else None
                except (ValueError, TypeError):
                    data[column] = value
        result[zip_code] = data
    
    return result

def main():
    """Main processing function."""
    url = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz"
    
    data = download_redfin_data(url)
    if data is None:
        print("Failed to download data. Exiting gracefully.")
        return
    
    try:
        print("Decompressing and parsing data...")
        buffer = BytesIO(data)  # >>> STREAM BUFFER
        with gzip.GzipFile(fileobj=buffer) as f:
            df = pd.read_csv(f, sep='\t')
        
        print(f"Loaded {len(df)} rows from Redfin data")
        df_clean = clean_and_convert_data(df)
        print(f"Processed {len(df_clean)} ZIP codes")
        
        output_data = format_data_for_output(df_clean)
        
        output_dir = Path("public/data")
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / "zip_data.json"
        
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        if not output_file.exists():
            print(f"ERROR: Failed to create output file at {output_file}")  # >>> SAFEGUARD
        else:
            print(f"Successfully wrote {len(output_data)} ZIP codes to {output_file}")
        
        if output_data:
            sample_zip = random.choice(list(output_data.keys()))  # >>> RANDOM SAMPLE
            print(f"\nSample data for ZIP {sample_zip}:")
            print(json.dumps({sample_zip: output_data[sample_zip]}, indent=2))
    
    except Exception as e:
        logging.error(f"Error processing data: {e}")
        print(f"Error processing data: {e}")
        
        # >>> ADDITIONAL ERROR LOG DUMP FOR CI DEBUGGING
        if os.path.exists("data_pipeline.log"):
            print("\n=== Error Log ===")
            with open("data_pipeline.log") as log_file:
                print(log_file.read())
        
        raise

if __name__ == "__main__":
    main()
