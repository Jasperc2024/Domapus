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
    if (!colorScaleDomain || colorScaleDomain[0] === null || colorScaleDomain[1] === null) {
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
      "median-sale-price": "Median Sale Price",
      "median-list-price": "Median List Price",
      "median-dom": "Median Days on Market",
      "inventory": "Current Inventory",
      "homes-sold": "Homes Sold",
      "sale-to-list-ratio": "Sale-to-List Ratio",
    };
    return metricNames[metric] || "Metric";
  };


  return (
    <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg p-3 shadow-lg w-full max-w-xs">
      <h3 className="text-xs font-semibold mb-2 text-gray-800">
        {getMetricDisplayName(selectedMetric)}
      </h3>
      <div
        className="h-3 rounded"
        style={{ background: "linear-gradient(to right, #FFF9B0, #E84C61, #2E0B59)" }}
      />
      <div className="flex justify-between text-[10px] text-gray-600 mt-1 font-medium">
        <span>{legendDisplay.min}</span>
        <span>{legendDisplay.max}</span>
      </div>
    </div>
  );
}