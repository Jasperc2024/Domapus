import { ZipData } from '../../components/dashboard/map/types';

// Default ZipData object with all fields filled in
const defaultZipData: ZipData = {
  zipCode: "99999",
  city: "Testville",
  county: "Test County",
  state: "TS",
  parent_metro: "Test Metro, TS",
  latitude: 34.05,
  longitude: -118.25,
  period_end: "2025-05-31",
  
  // All market metrics are included
  median_sale_price: 500000,
  median_list_price: 510000,
  median_ppsf: 300,
  homes_sold: 100,
  pending_sales: 110,
  new_listings: 120,
  inventory: 200,
  months_of_supply: 2.0,
  median_dom: 30,
  avg_sale_to_list_ratio: 0.98,
  sold_above_list: 25.0,
  price_drops: 15.0,
  off_market_in_two_weeks: 50.0,
  
  // All YoY metrics
  median_sale_price_yoy_pct: 5.5,
  median_list_price_yoy_pct: 4.0,
  median_ppsf_yoy_pct: 2.1,
  homes_sold_yoy_pct: -10.0,
  pending_sales_yoy_pct: 1.5,
  new_listings_yoy_pct: -5.0,
  inventory_yoy_pct: 20.0,
  months_of_supply_yoy_pct: 0.5,
  median_dom_yoy_pct: 5.0,
  avg_sale_to_list_ratio_yoy_pct: -0.01,
  sold_above_list_yoy_pct: -2.5,
  price_drops_yoy_pct: 1.0,
  off_market_in_two_weeks_yoy_pct: -3.0,

  // All MoM metrics
  median_sale_price_mom_pct: 0.5,
  median_list_price_mom_pct: 0.2,
  median_ppsf_mom_pct: 0.1,
  homes_sold_mom_pct: 2.0,
  pending_sales_mom_pct: 1.0,
  new_listings_mom_pct: 3.0,
  inventory_mom_pct: -1.5,
  months_of_supply_mom_pct: -0.1,
  median_dom_mom_pct: -2.0,
  avg_sale_to_list_ratio_mom_pct: 0.005,
  sold_above_list_mom_pct: 0.5,
  price_drops_mom_pct: 0.2,
  off_market_in_two_weeks_mom_pct: 1.2,
};

/**
 * Creates a valid ZipData object for testing.
 * @param overrides - An object with any properties you want to customize for a specific test.
 * @returns A complete, valid ZipData object.
 */
export function createMockZipData(overrides: Partial<ZipData> = {}): ZipData {
  return {
    ...defaultZipData,
    ...overrides,
  };
}