// Data validation utilities for external data sources

export interface RawZipData {
  zip_code: string;
  state: string;
  city?: string | null;
  property_type?: string;
  period_end: string;
  seasonally_adjusted?: boolean;
  median_sale_price?: number | null;
  median_sale_price_mom_pct?: number | null;
  median_sale_price_yoy_pct?: number | null;
  median_list_price?: number | null;
  median_list_price_mom_pct?: number | null;
  median_list_price_yoy_pct?: number | null;
  homes_sold?: number | null;
  homes_sold_mom_pct?: number | null;
  homes_sold_yoy_pct?: number | null;
  new_listings?: number | null;
  inventory?: number | null;
  median_dom?: number | null;
  avg_sale_to_list_ratio?: number | null;
  sold_above_list?: number | null;
  off_market_in_two_weeks?: number | null;
  parent_metro?: string | null;
  [key: string]: any;
}

export interface ValidatedZipData {
  zipCode: string;
  state: string;
  city?: string;
  propertyType?: string;
  periodEnd: string;
  seasonallyAdjusted: boolean;
  medianSalePrice: number;
  medianSalePriceMoM?: number;
  medianSalePriceYoY?: number;
  medianListPrice: number;
  medianListPriceMoM?: number;
  medianListPriceYoY?: number;
  homesSold: number;
  homesSoldMoM?: number;
  homesSoldYoY?: number;
  newListings: number;
  inventory: number;
  medianDOM: number;
  saleToListRatio: number;
  homesSoldAboveList: number;
  offMarket2Weeks: number;
  parentMetro?: string;
}

// Validation functions
export function isValidZipCode(zipCode: string): boolean {
  return /^\d{5}$/.test(zipCode);
}

export function isValidState(state: string): boolean {
  return /^[A-Z]{2}$/.test(state) || state.length <= 20; // Allow full state names too
}

export function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

export function isValidPrice(price: any): price is number {
  return isValidNumber(price) && price >= 0;
}

export function isValidPercentage(pct: any): pct is number {
  return isValidNumber(pct) && pct >= -100 && pct <= 1000; // Allow for extreme market conditions
}

export function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && dateStr.length >= 8;
}

// Main validation function
export function validateZipData(rawData: RawZipData): ValidatedZipData | null {
  try {
    // Required fields validation
    if (!rawData.zip_code || !isValidZipCode(rawData.zip_code)) {
      console.warn(`Invalid ZIP code: ${rawData.zip_code}`);
      return null;
    }

    if (!rawData.state || !isValidState(rawData.state)) {
      console.warn(`Invalid state: ${rawData.state} for ZIP ${rawData.zip_code}`);
      return null;
    }

    if (!rawData.period_end || !isValidDate(rawData.period_end)) {
      console.warn(`Invalid period_end: ${rawData.period_end} for ZIP ${rawData.zip_code}`);
      return null;
    }

    // Create validated object with defaults for missing data
    const validated: ValidatedZipData = {
      zipCode: rawData.zip_code,
      state: rawData.state,
      city: rawData.city || undefined,
      propertyType: rawData.property_type || undefined,
      periodEnd: rawData.period_end,
      seasonallyAdjusted: Boolean(rawData.seasonally_adjusted),
      
      // Prices with validation
      medianSalePrice: isValidPrice(rawData.median_sale_price) ? rawData.median_sale_price : 0,
      medianListPrice: isValidPrice(rawData.median_list_price) ? rawData.median_list_price : 0,
      
      // Counts with validation
      homesSold: isValidNumber(rawData.homes_sold) && rawData.homes_sold >= 0 ? rawData.homes_sold : 0,
      newListings: isValidNumber(rawData.new_listings) && rawData.new_listings >= 0 ? rawData.new_listings : 0,
      inventory: isValidNumber(rawData.inventory) && rawData.inventory >= 0 ? rawData.inventory : 0,
      
      // Days on market
      medianDOM: isValidNumber(rawData.median_dom) && rawData.median_dom >= 0 ? rawData.median_dom : 0,
      
      // Ratios and percentages
      saleToListRatio: isValidNumber(rawData.avg_sale_to_list_ratio) ? rawData.avg_sale_to_list_ratio : 1.0,
      homesSoldAboveList: isValidNumber(rawData.sold_above_list) && rawData.sold_above_list >= 0 ? rawData.sold_above_list : 0,
      offMarket2Weeks: isValidPercentage(rawData.off_market_in_two_weeks) ? rawData.off_market_in_two_weeks : 0,
      
      // Optional fields
      parentMetro: rawData.parent_metro || undefined,
    };

    // Add MoM and YoY percentages if valid
    if (isValidPercentage(rawData.median_sale_price_mom_pct)) {
      validated.medianSalePriceMoM = rawData.median_sale_price_mom_pct;
    }
    if (isValidPercentage(rawData.median_sale_price_yoy_pct)) {
      validated.medianSalePriceYoY = rawData.median_sale_price_yoy_pct;
    }
    if (isValidPercentage(rawData.median_list_price_mom_pct)) {
      validated.medianListPriceMoM = rawData.median_list_price_mom_pct;
    }
    if (isValidPercentage(rawData.median_list_price_yoy_pct)) {
      validated.medianListPriceYoY = rawData.median_list_price_yoy_pct;
    }
    if (isValidPercentage(rawData.homes_sold_mom_pct)) {
      validated.homesSoldMoM = rawData.homes_sold_mom_pct;
    }
    if (isValidPercentage(rawData.homes_sold_yoy_pct)) {
      validated.homesSoldYoY = rawData.homes_sold_yoy_pct;
    }

    return validated;

  } catch (error) {
    console.error(`Error validating ZIP data for ${rawData.zip_code}:`, error);
    return null;
  }
}

// Batch validation function
export function validateZipDataBatch(rawDataArray: RawZipData[]): ValidatedZipData[] {
  const validated: ValidatedZipData[] = [];
  const errors: string[] = [];

  for (const rawData of rawDataArray) {
    const validatedData = validateZipData(rawData);
    if (validatedData) {
      validated.push(validatedData);
    } else {
      errors.push(rawData.zip_code || 'Unknown ZIP');
    }
  }

  if (errors.length > 0) {
    console.warn(`Failed to validate ${errors.length} ZIP codes:`, errors.slice(0, 10));
  }

  console.log(`Successfully validated ${validated.length} out of ${rawDataArray.length} ZIP codes`);
  return validated;
}