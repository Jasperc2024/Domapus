import { ZipData } from '@/components/dashboard/map/types';

// This is a raw representation of the data we might get, before validation.
export interface RawZipData {
  zip_code: string;
  state: string;
  city?: string;
  county?: string;
  parent_metro?: string;
  latitude?: number;
  longitude?: number;
  period_end: string;
  [key: string]: any; // Allows for any other properties
}

const US_STATES_AND_TERRITORIES = new Set([ 'Alabama', 'AL', 'Alaska', 'AK', 'Arizona', 'AZ', 'Arkansas', 'AR', 'California', 'CA', 'Colorado', 'CO', 'Connecticut', 'CT', 'Delaware', 'DE', 'Florida', 'FL', 'Georgia', 'GA', 'Hawaii', 'HI', 'Idaho', 'ID', 'Illinois', 'IL', 'Indiana', 'IN', 'Iowa', 'IA', 'Kansas', 'KS', 'Kentucky', 'KY', 'Louisiana', 'LA', 'Maine', 'ME', 'Maryland', 'MD', 'Massachusetts', 'MA', 'Michigan', 'MI', 'Minnesota', 'MN', 'Mississippi', 'MS', 'Missouri', 'MO', 'Montana', 'MT', 'Nebraska', 'NE', 'Nevada', 'NV', 'New Hampshire', 'NH', 'New Jersey', 'NJ', 'New Mexico', 'NM', 'New York', 'NY', 'North Carolina', 'NC', 'North Dakota', 'ND', 'Ohio', 'OH', 'Oklahoma', 'OK', 'Oregon', 'OR', 'Pennsylvania', 'PA', 'Rhode Island', 'RI', 'South Carolina', 'SC', 'South Dakota', 'SD', 'Tennessee', 'TN', 'Texas', 'TX', 'Utah', 'UT', 'Vermont', 'VT', 'Virginia', 'VA', 'Washington', 'WA', 'West Virginia', 'WV', 'Wisconsin', 'WI', 'Wyoming', 'WY', 'District of Columbia', 'DC' ]);

// --- VALIDATION HELPERS ---
export const isValidZipCode = (zip: unknown): boolean => typeof zip === 'string' && /^\d{5}$/.test(zip);
export const isValidState = (state: unknown): boolean => typeof state === 'string' && US_STATES_AND_TERRITORIES.has(state);
export const isValidNumber = (num: unknown): num is number => typeof num === 'number' && isFinite(num);
export const isValidDate = (date: unknown): boolean => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);

/**
 * Validates a single raw data object and transforms it into a complete,
 * type-safe ZipData object with snake_case keys, providing `null` for any missing fields.
 * Returns null if core required fields are invalid.
 */
export const validateZipData = (rawData: RawZipData): ZipData | null => {
  if (!isValidZipCode(rawData.zip_code) || !isValidState(rawData.state) || !isValidDate(rawData.period_end)) {
    console.warn('Invalid core data for ZIP record:', rawData);
    return null;
  }

  // --- THIS IS THE CRITICAL FIX ---
  // This returns a complete ZipData object with the correct snake_case keys.
  return {
    zipCode: rawData.zip_code, // Note: zipCode is the only camelCase key by our convention
    city: rawData.city || null,
    county: rawData.county || null,
    state: rawData.state,
    parent_metro: rawData.parent_metro || null,
    latitude: isValidNumber(rawData.latitude) ? rawData.latitude : null,
    longitude: isValidNumber(rawData.longitude) ? rawData.longitude : null,
    period_end: rawData.period_end,
    
    // Market Metrics
    median_sale_price: isValidNumber(rawData.median_sale_price) ? rawData.median_sale_price : null,
    median_list_price: isValidNumber(rawData.median_list_price) ? rawData.median_list_price : null,
    median_ppsf: isValidNumber(rawData.median_ppsf) ? rawData.median_ppsf : null,
    homes_sold: isValidNumber(rawData.homes_sold) ? rawData.homes_sold : null,
    pending_sales: isValidNumber(rawData.pending_sales) ? rawData.pending_sales : null,
    new_listings: isValidNumber(rawData.new_listings) ? rawData.new_listings : null,
    inventory: isValidNumber(rawData.inventory) ? rawData.inventory : null,
    months_of_supply: isValidNumber(rawData.months_of_supply) ? rawData.months_of_supply : null,
    median_dom: isValidNumber(rawData.median_dom) ? rawData.median_dom : null,
    avg_sale_to_list_ratio: isValidNumber(rawData.avg_sale_to_list_ratio) ? rawData.avg_sale_to_list_ratio : null,
    sold_above_list: isValidNumber(rawData.sold_above_list) ? rawData.sold_above_list : null,
    price_drops: isValidNumber(rawData.price_drops) ? rawData.price_drops : null,
    off_market_in_two_weeks: isValidNumber(rawData.off_market_in_two_weeks) ? rawData.off_market_in_two_weeks : null,
    
    // Year-over-Year Percentage Changes
    median_sale_price_yoy_pct: isValidNumber(rawData.median_sale_price_yoy_pct) ? rawData.median_sale_price_yoy_pct : null,
    median_list_price_yoy_pct: isValidNumber(rawData.median_list_price_yoy_pct) ? rawData.median_list_price_yoy_pct : null,
    median_ppsf_yoy_pct: isValidNumber(rawData.median_ppsf_yoy_pct) ? rawData.median_ppsf_yoy_pct : null,
    homes_sold_yoy_pct: isValidNumber(rawData.homes_sold_yoy_pct) ? rawData.homes_sold_yoy_pct : null,
    pending_sales_yoy_pct: isValidNumber(rawData.pending_sales_yoy_pct) ? rawData.pending_sales_yoy_pct : null,
    new_listings_yoy_pct: isValidNumber(rawData.new_listings_yoy_pct) ? rawData.new_listings_yoy_pct : null,
    inventory_yoy_pct: isValidNumber(rawData.inventory_yoy_pct) ? rawData.inventory_yoy_pct : null,
    months_of_supply_yoy_pct: isValidNumber(rawData.months_of_supply_yoy_pct) ? rawData.months_of_supply_yoy_pct : null,
    median_dom_yoy_pct: isValidNumber(rawData.median_dom_yoy_pct) ? rawData.median_dom_yoy_pct : null,
    avg_sale_to_list_ratio_yoy_pct: isValidNumber(rawData.avg_sale_to_list_ratio_yoy_pct) ? rawData.avg_sale_to_list_ratio_yoy_pct : null,
    sold_above_list_yoy_pct: isValidNumber(rawData.sold_above_list_yoy_pct) ? rawData.sold_above_list_yoy_pct : null,
    price_drops_yoy_pct: isValidNumber(rawData.price_drops_yoy_pct) ? rawData.price_drops_yoy_pct : null,
    off_market_in_two_weeks_yoy_pct: isValidNumber(rawData.off_market_in_two_weeks_yoy_pct) ? rawData.off_market_in_two_weeks_yoy_pct : null,
    
    // Month-over-Month Percentage Changes
    median_sale_price_mom_pct: isValidNumber(rawData.median_sale_price_mom_pct) ? rawData.median_sale_price_mom_pct : null,
    median_list_price_mom_pct: isValidNumber(rawData.median_list_price_mom_pct) ? rawData.median_list_price_mom_pct : null,
    median_ppsf_mom_pct: isValidNumber(rawData.median_ppsf_mom_pct) ? rawData.median_ppsf_mom_pct : null,
    homes_sold_mom_pct: isValidNumber(rawData.homes_sold_mom_pct) ? rawData.homes_sold_mom_pct : null,
    pending_sales_mom_pct: isValidNumber(rawData.pending_sales_mom_pct) ? rawData.pending_sales_mom_pct : null,
    new_listings_mom_pct: isValidNumber(rawData.new_listings_mom_pct) ? rawData.new_listings_mom_pct : null,
    inventory_mom_pct: isValidNumber(rawData.inventory_mom_pct) ? rawData.inventory_mom_pct : null,
    months_of_supply_mom_pct: isValidNumber(rawData.months_of_supply_mom_pct) ? rawData.months_of_supply_mom_pct : null,
    median_dom_mom_pct: isValidNumber(rawData.median_dom_mom_pct) ? rawData.median_dom_mom_pct : null,
    avg_sale_to_list_ratio_mom_pct: isValidNumber(rawData.avg_sale_to_list_ratio_mom_pct) ? rawData.avg_sale_to_list_ratio_mom_pct : null,
    sold_above_list_mom_pct: isValidNumber(rawData.sold_above_list_mom_pct) ? rawData.sold_above_list_mom_pct : null,
    price_drops_mom_pct: isValidNumber(rawData.price_drops_mom_pct) ? rawData.price_drops_mom_pct : null,
    off_market_in_two_weeks_mom_pct: isValidNumber(rawData.off_market_in_two_weeks_mom_pct) ? rawData.off_market_in_two_weeks_mom_pct : null,
  };
};

export const validateZipDataBatch = (rawDataArray: RawZipData[]): ZipData[] => {
  return rawDataArray.map(validateZipData).filter((d): d is ZipData => d !== null);
};