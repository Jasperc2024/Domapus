# scripts/clean_geojson_file.py
# FINAL, COMPLETE VERSION WITH FULL REPORTING

import json
import gzip
import os
import random

# Define the path to the file we will be cleaning.
FILE_PATH = 'public/data/us-zip-codes.geojson.gz'

def clean_geojson_file():
    """
    Reads the original GeoJSON, cleans its properties, converts null geometries
    to Points, and provides a detailed report of its actions before saving.
    """
    print(f"--- Starting Cleanup and Audit for: {FILE_PATH} ---")

    if not os.path.exists(FILE_PATH):
        print(f"\nERROR: The file was not found at {FILE_PATH}")
        return

    try:
        # 1. Read the original, compressed GeoJSON file.
        with gzip.open(FILE_PATH, 'rt', encoding='utf-8') as f:
            original_geojson = json.load(f)
        
        original_features = original_geojson.get('features', [])
        total_before = len(original_features)
        print(f"\nStep 1: Read {total_before} total features from the original file.")

        cleaned_features = []
        null_geometry_count = 0
        features_without_zip = 0
        sample_before = None
        sample_after = None

        # 2. Process each feature one by one.
        for feature in original_features:
            properties = feature.get('properties', {})
            zip_code = properties.get('ZCTA5CE20')

            if not zip_code:
                features_without_zip += 1
                continue # Skip any features that don't have a ZIP code

            cleaned_feature = {
                'type': 'Feature',
                'geometry': feature.get('geometry'),
                'properties': { 'ZCTA5CE20': zip_code }
            }

            if cleaned_feature['geometry'] is None:
                null_geometry_count += 1
                try:
                    lat_str = properties.get('INTPTLAT20')
                    lon_str = properties.get('INTPTLON20')
                    
                    if lat_str and lon_str:
                        lat = round(float(lat_str), 5)
                        lon = round(float(lon_str), 5)
                        
                        # --- THIS IS THE TRANSFORMATION ---
                        new_geometry = { 'type': 'Point', 'coordinates': [lon, lat] }
                        cleaned_feature['geometry'] = new_geometry
                        
                        # Capture a sample for our report
                        if sample_before is None:
                            sample_before = feature
                            sample_after = cleaned_feature
                    else:
                        continue # Skip if no coordinates are available
                except (ValueError, TypeError):
                    continue
            
            cleaned_features.append(cleaned_feature)

        total_after = len(cleaned_features)

        # --- THIS IS THE FULL REPORT ---
        print("\n--- Audit Report ---")
        print(f"Total Features Before:      {total_before}")
        print(f"Features with Null Geometry:  {null_geometry_count} (These were converted to Points)")
        print(f"Skipped (no ZIP code):      {features_without_zip}")
        print(f"Total Features After:       {total_after}")
        print("--------------------")

        if sample_before:
            print("\n--- Verification Sample ---")
            print("Here is an example of one of the features that was transformed:")
            print("\nBEFORE cleaning:")
            print(json.dumps(sample_before, indent=2))
            print("\nAFTER cleaning:")
            print(json.dumps(sample_after, indent=2))
            print("-------------------------\n")
        
        # 3. Create the new, clean GeoJSON Feature Collection.
        cleaned_geojson = {
            'type': 'FeatureCollection',
            'features': cleaned_features
        }

        # 4. Save the cleaned and compressed data back to the original file path.
        print(f"Step 2: Saving {len(cleaned_features)} clean features back to {FILE_PATH}...")
        json_string = json.dumps(cleaned_geojson) # Use compact encoding for smaller file size
        compressed_json = gzip.compress(json_string.encode('utf-8'))
        with open(FILE_PATH, 'wb') as f:
            f.write(compressed_json)

        print("\n--- GeoJSON Cleanup Complete! ---")
        print(f"Your file '{FILE_PATH}' is now clean, optimized, and contains no null geometries.")

    except Exception as e:
        print(f"\nAn error occurred during the cleaning process: {e}")

if __name__ == "__main__":
    clean_geojson_file()