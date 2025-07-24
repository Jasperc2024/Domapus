// src/components/dashboard/ExportLegend.tsx
// FINAL, CORRECTED, AND WORKING VERSION

import { useMemo } from "react";
import { ZipData } from "./map/types";
import { getMetricDisplay } from "./map/utils"; // We assume utils.ts is correct now
import { ExportOptions } from "./ExportSidebar";

// --- THIS IS THE CRITICAL FIX ---
// This interface now correctly accepts 'filteredZipData'
interface ExportLegendProps {
  filteredZipData: ZipData[];
  selectedMetric: string;
  exportOptions: ExportOptions;
  className?: string;
}

export function ExportLegend({
  filteredZipData,
  selectedMetric,
  exportOptions, // Kept for consistency, may not be used directly
  className = "",
}: ExportLegendProps) {

  // This useMemo hook is the "brain" of the component. It runs instantly.
  const legendData = useMemo(() => {
    if (filteredZipData.length === 0) {
      return { minDisplay: "N/A", maxDisplay: "N/A", quintileDisplays: [], zipCount: 0 };
    }

    const values = filteredZipData
      .map(zip => zip[selectedMetric as keyof ZipData] as number)
      .filter(v => typeof v === 'number' && v > 0)
      .sort((a, b) => a - b);
      
    if (values.length === 0) {
      return { minDisplay: "N/A", maxDisplay: "N/A", quintileDisplays: [], zipCount: filteredZipData.length };
    }

    const minZip = filteredZipData.find(z => z[selectedMetric as keyof ZipData] === values[0]);
    const maxZip = filteredZipData.find(z => z[selectedMetric as keyof ZipData] === values[values.length - 1]);

    const quintileDisplays: string[] = [];
    for (let i = 0; i <= 4; i++) {
      const index = Math.floor((values.length - 1) * (i / 4));
      const quintileValue = values[index];
      const zipForQuintile = filteredZipData.find(z => z[selectedMetric as keyof ZipData] === quintileValue);
      if (zipForQuintile) {
        // We get the full HTML and then strip it for the tiny display area
        const displayHTML = getMetricDisplay(zipForQuintile, selectedMetric);
        quintileDisplays.push(displayHTML.replace(/<[^>]*>?/gm, ''));
      } else {
        quintileDisplays.push('N/A');
      }
    }
    
    const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');

    return {
      minDisplay: minZip ? stripHtml(getMetricDisplay(minZip, selectedMetric)) : "N/A",
      maxDisplay: maxZip ? stripHtml(getMetricDisplay(maxZip, selectedMetric)) : "N/A",
      quintileDisplays,
      zipCount: filteredZipData.length
    };
  }, [filteredZipData, selectedMetric]);

  const { minDisplay, maxDisplay, quintileDisplays, zipCount } = legendData;

  return (
    <div className={`bg-white border border-gray-300 rounded p-4 inline-block ${className}`}>
      <h3 className="text-sm font-semibold mb-3 text-gray-900">Legend</h3>
      <div className="mb-3">
        <div
          className="h-4 rounded-lg"
          style={{ background: "linear-gradient(to right, #FFF9B0, #FFA873, #E84C61, #922C7E, #2E0B59)" }}
        />
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
              <div
                className="w-4 h-4 rounded mx-auto mb-1"
                style={{ backgroundColor: colors[index] }}
              />
              <span className="text-[10px] text-gray-600 leading-tight block">{value}</span>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">
        {zipCount.toLocaleString()} ZIP codes
      </div>
    </div>
  );
}