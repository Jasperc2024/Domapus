export interface ZipData {
  // Location Data (from the merged CSV)
  zipCode: string; // Added during processing
  city: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  
  // Base Info (from Redfin)
  state: string;
  parent_metro: string | null;
  period_end: string;
  
  // Market Metrics (from Redfin)
  median_sale_price: number | null;
  median_list_price: number | null;
  median_ppsf: number | null;
  homes_sold: number | null;
  pending_sales: number | null;
  new_listings: number | null;
  inventory: number | null;
  months_of_supply: number | null;
  median_dom: number | null;
  avg_sale_to_list_ratio: number | null;
  sold_above_list: number | null;
  price_drops: number | null;
  off_market_in_two_weeks: number | null;

  // Year-over-Year Percentage Changes
  median_sale_price_yoy_pct: number | null;
  median_list_price_yoy_pct: number | null;
  median_ppsf_yoy_pct: number | null;
  homes_sold_yoy_pct: number | null;
  pending_sales_yoy_pct: number | null;
  new_listings_yoy_pct: number | null;
  inventory_yoy_pct: number | null;
  months_of_supply_yoy_pct: number | null;
  median_dom_yoy_pct: number | null;
  avg_sale_to_list_ratio_yoy_pct: number | null;
  sold_above_list_yoy_pct: number | null;
  price_drops_yoy_pct: number | null;
  off_market_in_two_weeks_yoy_pct: number | null;
  
  // Month-over-Month Percentage Changes
  median_sale_price_mom_pct: number | null;
  median_list_price_mom_pct: number | null;
  median_ppsf_mom_pct: number | null;
  homes_sold_mom_pct: number | null;
  pending_sales_mom_pct: number | null;
  new_listings_mom_pct: number | null;
  inventory_mom_pct: number | null;
  months_of_supply_mom_pct: number | null;
  median_dom_mom_pct: number | null;
  avg_sale_to_list_ratio_mom_pct: number | null;
  sold_above_list_mom_pct: number | null;
  price_drops_mom_pct: number | null;
  off_market_in_two_weeks_mom_pct: number | null;
}
