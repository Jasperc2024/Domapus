import { ZipData } from "./types";

// Type for format options used in formatting functions
export type FormatType = 'currency' | 'number' | 'percent' | 'ratio' | 'price' | 'days' | 'percentage';

// Metric info type for reuse across components
export interface MetricInfo {
  key: keyof ZipData;
  label: string;
  format: FormatType;
  momKey?: keyof ZipData;
  yoyKey?: keyof ZipData;
}

// Standard metric definitions for reuse
export const METRIC_DEFINITIONS: Record<string, MetricInfo> = {
  zhvi: { key: "zhvi", label: "Zillow Home Value Index", format: 'currency', momKey: "zhvi_mom", yoyKey: "zhvi_yoy" },
  median_sale_price: { key: "median_sale_price", label: "Median Sale Price", format: 'currency', momKey: "median_sale_price_mom", yoyKey: "median_sale_price_yoy" },
  median_list_price: { key: "median_list_price", label: "Median List Price", format: 'currency', momKey: "median_list_price_mom", yoyKey: "median_list_price_yoy" },
  median_ppsf: { key: "median_ppsf", label: "Median Price per Sq Ft", format: 'currency', momKey: "median_ppsf_mom", yoyKey: "median_ppsf_yoy" },
  homes_sold: { key: "homes_sold", label: "Homes Sold", format: 'number', momKey: "homes_sold_mom", yoyKey: "homes_sold_yoy" },
  pending_sales: { key: "pending_sales", label: "Pending Sales", format: 'number', momKey: "pending_sales_mom", yoyKey: "pending_sales_yoy" },
  new_listings: { key: "new_listings", label: "New Listings", format: 'number', momKey: "new_listings_mom", yoyKey: "new_listings_yoy" },
  inventory: { key: "inventory", label: "Inventory", format: 'number', momKey: "inventory_mom", yoyKey: "inventory_yoy" },
  median_dom: { key: "median_dom", label: "Median Days on Market", format: 'number', momKey: "median_dom_mom", yoyKey: "median_dom_yoy" },
  avg_sale_to_list_ratio: { key: "avg_sale_to_list_ratio", label: "Sale-to-List Ratio", format: 'ratio', momKey: "avg_sale_to_list_mom", yoyKey: "avg_sale_to_list_ratio_yoy" },
  sold_above_list: { key: "sold_above_list", label: "% Sold Above List", format: 'percent', momKey: "sold_above_list_mom", yoyKey: "sold_above_list_yoy" },
  off_market_in_two_weeks: { key: "off_market_in_two_weeks", label: "% Off Market in 2 Weeks", format: 'percent', momKey: "off_market_in_two_weeks_mom", yoyKey: "off_market_in_two_weeks_yoy" },
};

// Helper to get metric value with proper typing
export function getMetricValue(data: ZipData | undefined, metric: string): number {
  if (!data) return 0;
  const value = data[metric as keyof ZipData];
  return typeof value === "number" && isFinite(value) ? value : 0;
}

// Format any numeric value based on format type
export function formatMetricValue(value: number | null | undefined, format: FormatType): string {
  if (value === null || value === undefined || isNaN(value)) return "N/A";

  switch (format) {
    case 'currency':
    case 'price':
      return `$${value.toLocaleString()}`;
    case 'percent':
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'ratio':
      return `${value.toFixed(1)}%`;
    case 'days':
      return `${value} days`;
    case 'number':
    default:
      return value.toLocaleString();
  }
}

// Format change values (MoM, YoY) with sign indicator
export function formatChange(value: number | null | undefined): { formatted: string; isPositive: boolean; isZero: boolean } {
  if (value === null || value === undefined) return { formatted: "N/A", isPositive: false, isZero: true };
  const numValue = Number(value);
  if (isNaN(numValue)) return { formatted: "N/A", isPositive: false, isZero: true };
  const isPositive = numValue > 0;
  const isZero = numValue === 0;
  return { formatted: `${isPositive ? "+" : ""}${numValue.toFixed(1)}%`, isPositive, isZero };
}

// Compare two values for comparison views
export function getComparison(current: number | null | undefined, compare: number | null | undefined): 'higher' | 'lower' | 'same' {
  const currentNum = Number(current);
  const compareNum = Number(compare);
  if (isNaN(currentNum) || isNaN(compareNum)) return 'same';

  const diff = currentNum - compareNum;
  if (Math.abs(diff) < 0.01) return 'same';
  return diff > 0 ? 'higher' : 'lower';
}

// Compute quantile buckets for choropleth coloring
export function computeQuantileBuckets(values: number[], numBuckets = 8): number[] {
  const sorted = [...values].filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const minVal = sorted[0];
  const maxVal = sorted[sorted.length - 1];
  if (minVal === maxVal) return [minVal];

  const thresholds: number[] = [];
  const epsilon = (maxVal - minVal) * 1e-6 || 1e-6;

  const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))];

  for (let i = 1; i < numBuckets; i++) {
    let val = q(i / numBuckets);
    if (thresholds.length && val <= thresholds[thresholds.length - 1]) {
      val = thresholds[thresholds.length - 1] + epsilon;
    }
    thresholds.push(val);
  }

  return thresholds;
}

export function getMetricDisplay(data: ZipData, selectedMetric: string): string {
  if (!data || !data.zipCode) {
    return `<div class="p-2">No data available</div>`;
  }

  const metricInfo = METRIC_DEFINITIONS[selectedMetric];
  const value = metricInfo ? data[metricInfo.key] : null;
  const formattedValue = typeof value === 'number' && isFinite(value)
    ? formatMetricValue(value, metricInfo?.format || 'number')
    : "N/A";

  return `
      <div class="font-bold text-base">${data.zipCode}</div>
      <div class="text-sm text-gray-600">${data.city || "Unknown City"}, ${data.state}</div>
      <div class="text-sm mt-2">
        <span class="font-semibold">${metricInfo?.label || selectedMetric}:</span>
        <span class="font-normal"> ${formattedValue}</span>
      <div class="text-[10px] text-gray-400 mt-1 flex items-center">
        Click to view details
      </div>
  `;
}
