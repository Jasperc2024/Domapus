import { useMemo } from 'react';

interface LegendProps {
  selectedMetric: string;
  metricValues: number[];
  isExport?: boolean; // Optional prop to remove interactive hints for PDF
}

// Number formatting helper
function formatLegendValue(value: number, metric: string): string {
  const m = metric.toLowerCase();
  if (m.includes('price')) return `$${(value / 1000).toFixed(0)}k`;
  if (m.includes('ratio') || m.includes('above')) return `${(value * 100).toFixed(0)}%`;
  if (m.includes('dom')) return `${Math.round(value)}`;
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

export function Legend({ selectedMetric, metricValues, isExport = false }: LegendProps) {
  const legendDisplay = useMemo(() => {
    if (!metricValues || metricValues.length === 0) {
      return { min: 'N/A', mid: 'N/A', max: 'N/A' };
    }

    // 5th, 50th, 95th percentiles for robust min/mid/max (ignores extreme outliers)
    const [min, mid, max] = computeQuantiles(metricValues, [0.05, 0.5, 0.95]);

    return {
      min: formatLegendValue(min, selectedMetric),
      mid: formatLegendValue(mid, selectedMetric),
      max: formatLegendValue(max, selectedMetric),
    };
  }, [metricValues, selectedMetric]);

  const getMetricDisplayName = (metric: string): string => {
    // Normalize input to snake_case for lookup
    const normalizedKey = metric.replace(/-/g, '_');
    
    const metricNames: Record<string, string> = {
      median_sale_price: 'Median Sale Price',
      median_ppsf: 'Median Price per Sq Ft',
      sale_to_list_ratio: 'Sale-to-List Ratio',
      avg_sale_to_list_ratio: 'Sale-to-List Ratio',// Handle potential naming variations     
      median_dom: 'Median Days on Market', 
    };
    
    return metricNames[normalizedKey] || normalizedKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className={`
      border border-gray-300 rounded-lg p-4 w-full max-w-xs
      ${isExport ? 'bg-white shadow-none' : 'bg-white/95 backdrop-blur-sm shadow-xl'}
    `}>
      <h3 className="text-sm font-bold mb-3 text-gray-900">
        {getMetricDisplayName(selectedMetric)}
      </h3>

      <div className="space-y-2">
        {/* Color Gradient Bar */}
        <div
          className="h-4 rounded-md border border-gray-200"
          style={{
            background:
              'linear-gradient(to right, #FFF9B0, #FFEB84, #FFD166, #FF9A56, #E84C61, #C13584, #7B2E8D, #2E0B59)'
          }}
        />

        {/* 3-value Legend Labels */}
        <div className="flex justify-between text-xs text-gray-700 font-bold">
          <span>{legendDisplay.min}</span>
          <span>{legendDisplay.mid}</span>
          <span>{legendDisplay.max}</span>
        </div>
      </div>

      {!isExport && (
        <div className="mt-1 pt-1 border-gray-200">
          <p className="text-[10px] text-gray-500 text-center">
            Click ZIP code to view more info
          </p>
        </div>
      )}
    </div>
  );
}