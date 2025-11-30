import { useMemo } from 'react';

interface LegendProps {
  selectedMetric: string;
  metricValues: number[]; // array of actual metric values for the current metric
}

// Number formatting helper
function formatLegendValue(value: number, metric: string): string {
  if (metric.includes('price')) return `$${(value / 1000).toFixed(0)}k`;
  if (metric.includes('ratio') || metric.includes('above-list')) return `${(value * 100).toFixed(0)}%`;
  if (metric.includes('dom')) return `${Math.round(value)}`;
  return value.toLocaleString();
}

// Compute arbitrary percentiles
function computeQuantiles(values: number[], percentiles: number[]) {
  if (!values || values.length === 0) return percentiles.map(() => 0);
  const sorted = [...values].sort((a, b) => a - b);
  return percentiles.map(p => {
    const idx = (sorted.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  });
}

export function Legend({ selectedMetric, metricValues }: LegendProps) {
  const legendDisplay = useMemo(() => {
    if (!metricValues || metricValues.length === 0) {
      return { min: 'N/A', mid: 'N/A', max: 'N/A' };
    }

    // 5th, 50th, 95th percentiles for robust min/mid/max
    const [min, mid, max] = computeQuantiles(metricValues, [0.05, 0.5, 0.95]);

    return {
      min: formatLegendValue(min, selectedMetric),
      mid: formatLegendValue(mid, selectedMetric),
      max: formatLegendValue(max, selectedMetric),
    };
  }, [metricValues, selectedMetric]);

  const getMetricDisplayName = (metric: string): string => {
    const metricNames: Record<string, string> = {
      median_sale_price: 'Median Sale Price',
      median_list_price: 'Median List Price',
      median_dom: 'Median Days on Market',
      inventory: 'Current Inventory',
      homes_sold: 'Homes Sold',
      new_listings: 'New Listings',
      avg_sale_to_list_ratio: 'Sale-to-List Ratio',
      sold_above_list: 'Sold Above List',
      off_market_in_two_weeks: 'Off Market in 2 Weeks',
    };
    return metricNames[metric] || 'Metric';
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-300 rounded-lg p-4 shadow-xl w-full max-w-xs">
      <h3 className="text-sm font-bold mb-3 text-gray-900">
        {getMetricDisplayName(selectedMetric)}
      </h3>

      <div className="space-y-2">
        {/* color gradient bar */}
        <div
          className="h-4 rounded-md border border-gray-200"
          style={{
            background:
              'linear-gradient(to right, #FFF9B0, #FFEB84, #FFD166, #FF9A56, #E84C61, #C13584, #7B2E8D, #2E0B59)'
          }}
        />

        {/* 3-value legend */}
        <div className="flex justify-between text-xs text-gray-700 font-semibold">
          <span>{legendDisplay.min}</span>
          <span>{legendDisplay.mid}</span>
          <span>{legendDisplay.max}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-[10px] text-gray-500 text-center">
          Click zip code to view full info
        </p>
      </div>
    </div>
  );
}
