import { useMemo } from 'react';

interface LegendProps {
  selectedMetric: string;
  colorScaleDomain: [number, number] | null;
}

// A small helper to format numbers based on the metric type
function formatLegendValue(value: number, metric: string): string {
  if (metric.includes('price')) {
    return `$${(value / 1000).toFixed(0)}k`; // Format as thousands
  }
  if (metric.includes('ratio') || metric.includes('above-list')) {
    return `${(value * 100).toFixed(0)}%`;
  }
  if (metric.includes('dom')) {
    return `${Math.round(value)}`;
  }
  return value.toLocaleString();
}

export function Legend({ selectedMetric, colorScaleDomain }: LegendProps) {

  const legendDisplay = useMemo(() => {
    if (!colorScaleDomain) {
      return { min: "N/A", max: "N/A" };
    }
    const [min, max] = colorScaleDomain;
    return {
      min: formatLegendValue(min, selectedMetric),
      max: formatLegendValue(max, selectedMetric),
    };
  }, [selectedMetric, colorScaleDomain]);
  
  const getMetricDisplayName = (metric: string): string => {
    const metricNames: Record<string, string> = {
      "median_sale_price": "Median Sale Price",
      "median_list_price": "Median List Price",
      "median_dom": "Median Days on Market",
      "inventory": "Current Inventory",
      "homes_sold": "Homes Sold",
      "new_listings": "New Listings",
      "avg_sale_to_list_ratio": "Sale-to-List Ratio",
      "sold_above_list": "Sold Above List",
      "off_market_in_two_weeks": "Off Market in 2 Weeks",
    };
    return metricNames[metric] || "Metric";
  };


  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-300 rounded-lg p-4 shadow-xl w-full max-w-xs">
      <h3 className="text-sm font-bold mb-3 text-gray-900">
        {getMetricDisplayName(selectedMetric)}
      </h3>
      <div className="space-y-2">
        <div
          className="h-4 rounded-md border border-gray-200"
          style={{ background: "linear-gradient(to right, #FFF9B0, #FFEB84, #FFD166, #FF9A56, #E84C61, #C13584, #7B2E8D, #2E0B59)" }}
        />
        <div className="flex justify-between text-xs text-gray-700 font-semibold">
          <span>Low: {legendDisplay.min}</span>
          <span>High: {legendDisplay.max}</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-[10px] text-gray-500 text-center">
          Hover over ZIP codes to see details • Click to view full info
        </p>
      </div>
    </div>
  );
}