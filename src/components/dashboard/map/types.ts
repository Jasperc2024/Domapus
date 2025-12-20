export interface ZipData {
  // Location Data (from zcta-meta.csv mapping)
  zipCode: string;
  city: string | null;
  county: string | null;
  state: string | null;
  metro: string | null;
  latitude: number | null;
  longitude: number | null;
  period_end: string | null;

  // Zillow ZHVI Metrics
  zhvi: number | null;
  zhvi_mom: number | null;
  zhvi_yoy: number | null;

  // Median Prices
  median_sale_price: number | null;
  median_sale_price_mom: number | null;
  median_sale_price_yoy: number | null;
  median_list_price: number | null;
  median_list_price_mom: number | null;
  median_list_price_yoy: number | null;
  median_ppsf: number | null;
  median_ppsf_mom: number | null;
  median_ppsf_yoy: number | null;

  // Inventory & Sales Volume
  homes_sold: number | null;
  homes_sold_mom: number | null;
  homes_sold_yoy: number | null;
  pending_sales: number | null;
  pending_sales_mom: number | null;
  pending_sales_yoy: number | null;
  new_listings: number | null;
  new_listings_mom: number | null;
  new_listings_yoy: number | null;
  inventory: number | null;
  inventory_mom: number | null;
  inventory_yoy: number | null;

  // Market Speed & Ratios
  median_dom: number | null;
  median_dom_mom: number | null;
  median_dom_yoy: number | null;
  avg_sale_to_list_ratio: number | null;
  avg_sale_to_list_mom: number | null;
  avg_sale_to_list_ratio_yoy: number | null; // Note: Python key matches this exactly
  sold_above_list: number | null;
  sold_above_list_mom: number | null;
  sold_above_list_yoy: number | null;
  off_market_in_two_weeks: number | null;
  off_market_in_two_weeks_mom: number | null;
  off_market_in_two_weeks_yoy: number | null;
}