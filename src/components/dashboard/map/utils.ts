import { ZipData } from "./types"; 

export function formatMetricValue(value: number, format: 'currency' | 'number' | 'percent' | 'ratio'): string {
  if (value === null || value === undefined || isNaN(value)) return "N/A";
  
  switch (format) {
    case 'currency':
      return `$${value.toLocaleString()}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'ratio':
      return `${(value * 100).toFixed(1)}%`;
    case 'number':
      return value.toLocaleString();
    default:
      return value.toString();
  }
}

export function getMetricDisplay(data: ZipData, selectedMetric: string): string {
  if (!data || !data.zipCode) {
    return `<div class="p-2">No data available</div>`;
  }

  // This map translates the UI metric name to the actual data key and provides formatting rules.
  const metricMap: Record<string, { key: keyof ZipData; label: string; format: 'currency' | 'number' | 'percent' | 'ratio' }> = {
    "median-sale-price": { key: "median_sale_price", label: "Median Sale Price", format: 'currency' },
    "median-list-price": { key: "median_list_price", label: "Median List Price", format: 'currency' },
    "median-dom": { key: "median_dom", label: "Median Days on Market", format: 'number' },
    "inventory": { key: "inventory", label: "Inventory", format: 'number' },
    "new-listings": { key: "new_listings", label: "New Listings", format: 'number' },
    "homes-sold": { key: "homes_sold", label: "Homes Sold", format: 'number' },
    "sale-to-list-ratio": { key: "avg_sale_to_list_ratio", label: "Sale-to-List Ratio", format: 'ratio' },
    "homes-sold-above-list": { key: "sold_above_list", label: "% Sold Above List", format: 'percent' },
    "off-market-2-weeks": { key: "off_market_in_two_weeks", label: "% Off Market in 2 Weeks", format: 'percent' },
  };

  const metricInfo = metricMap[selectedMetric];
  // The data object is already complete, so we access the key directly.
  const value = metricInfo ? data[metricInfo.key] : null;

  let formattedValue = "N/A";
  if (typeof value === 'number' && isFinite(value)) {
    switch (metricInfo.format) {
      case 'currency':
        formattedValue = `$${value.toLocaleString()}`;
        break;
      case 'percent':
        // Assumes the value is already a percentage number, e.g., 34.5
        formattedValue = `${value.toFixed(1)}%`;
        break;
      case 'ratio':
        // Assumes the value is a decimal ratio, e.g., 0.98
        formattedValue = `${(value * 100).toFixed(1)}%`;
        break;
      case 'number':
        formattedValue = value.toLocaleString();
        break;
    }
  }

  // Returns the final, styled HTML for the map tooltip.
  return `
    <div class="p-2 bg-white rounded shadow-lg border text-black font-sans">
      <div class="font-bold text-base">${data.zipCode}</div>
      <div class="text-sm text-gray-600">${data.city || "Unknown City"}, ${data.state}</div>
      <div class="text-sm mt-2">
        <span class="font-semibold">${metricInfo?.label || selectedMetric}:</span>
        <span class="font-normal"> ${formattedValue}</span>
      </div>
    </div>
  `;
}