"""Shim module to allow importing functions from update-market-data.py in tests."""
from importlib.machinery import SourceFileLoader
from pathlib import Path

_module_path = Path(__file__).with_name("update-market-data.py")
_loaded = SourceFileLoader("update_market_data_impl", str(_module_path)).load_module()

extract_zip_code = _loaded.extract_zip_code
get_full_column_mapping = _loaded.get_full_column_mapping
process_zillow_data = _loaded.process_zillow_data
