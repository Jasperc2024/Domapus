import { useMemo } from "react";
import { ZipData } from "./map/types";
import { formatMetricValue } from "./map/utils";
import { ExportOptions } from "./ExportSidebar";

interface ExportLegendProps {
  filteredZipData: ZipData[];
  selectedMetric: string;
  exportOptions: ExportOptions;
  className?: string;
}

export function ExportLegend({
  filteredZipData,
  selectedMetric,
  className = "",
}: ExportLegendProps) {

  const legendData = useMemo(() => {
    const metricMap: Record<string, { key: keyof ZipData; format: 'currency' | 'number' | 'percent' | 'ratio' }> = {
      "median-sale-price": { key: "median_sale_price", format: 'currency' },
      "median-list-price": { key: "median_list_price", format: 'currency' },
      "median-dom": { key: "median_dom", format: 'number' },
      "inventory": { key: "inventory", format: 'number' },
      "new-listings": { key: "new_listings", format: 'number' },
      "homes-sold": { key: "homes_sold", format: 'number' },
      "sale-to-list-ratio": { key: "avg_sale_to_list_ratio", format: 'ratio' },
      "homes-sold-above-list": { key: "sold_above_list", format: 'percent' },
      "off-market-2-weeks": { key: "off_market_in_two_weeks", format: 'percent' },
    };

    const metricInfo = metricMap[selectedMetric];
    
    // This is now defensively coded. It checks for the existence of data at every step.
    if (!metricInfo || !Array.isArray(filteredZipData) || filteredZipData.length === 0) {
      return { minDisplay: "N/A", maxDisplay: "N/A", quintileDisplays: [], zipCount: 0 };
    }

    const values = filteredZipData
      .map(zip => zip[metricInfo.key] as number)
      .filter(v => typeof v === 'number' && isFinite(v) && v > 0)
      .sort((a, b) => a - b);
      
    // This is the robust check for the [0] access.
    if (values.length < 2) {
      return { minDisplay: "N/A", maxDisplay: "N/A", quintileDisplays: [], zipCount: filteredZipData.length };
    }

    const quintileDisplays: string[] = [];
    for (let i = 0; i <= 4; i++) {
      const index = Math.floor((values.length - 1) * (i / 4));
      quintileDisplays.push(formatMetricValue(values[index], metricInfo.format));
    }
    
    return {
      minDisplay: formatMetricValue(values[0], metricInfo.format),
      maxDisplay: formatMetricValue(values[values.length - 1], metricInfo.format),
      quintileDisplays,
      zipCount: filteredZipData.length
    };
  }, [filteredZipData, selectedMetric]);

  const { minDisplay, maxDisplay, quintileDisplays, zipCount } = legendData;

  return (
    <div className={`bg-white border border-gray-300 rounded p-4 inline-block ${className}`}>
      <h3 className="text-sm font-semibold mb-3 text-gray-900">Legend</h3>
      <div className="mb-3">
        <div className="h-4 rounded-lg" style={{ background: "linear-gradient(to right, #FFF9B0, #FFA873, #E84C61, #922C7E, #2E0B59)" }} />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>{minDisplay}</span>
          <span>{maxDisplay}</span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 mb-3">
        {quintileDisplays.map((value, index) => {
          const colors = ["#FFF9B0", "#FFA873", "#E84C61", "#922C7E", "#2E0B59"];
          return (
            <div key={index} className="text-center">
              <div className="w-4 h-4 rounded mx-auto mb-1" style={{ backgroundColor: colors[index] }} />
              <span className="text-[10px] text-gray-600 leading-tight block">{value}</span>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">{zipCount.toLocaleString()} ZIP codes</div>
    </div>
  );
}