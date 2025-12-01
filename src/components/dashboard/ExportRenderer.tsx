import { useRef, useCallback } from "react";
import { ExportMap } from "./ExportMap";
import { Legend } from "./Legend";
import { DomapusLogo } from "@/components/ui/domapus-logo";
import { ZipData } from "./map/types";
import { ExportOptions } from "./ExportSidebar";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ExportRendererProps {
  filteredData: ZipData[];
  filteredGeoJSON: GeoJSON.FeatureCollection | null;
  selectedMetric: string;
  exportOptions: ExportOptions;
  onExportComplete: () => void;
}

export function ExportRenderer({
  filteredData,
  filteredGeoJSON,
  selectedMetric,
  exportOptions,
  onExportComplete,
}: ExportRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRenderComplete = useCallback(async () => {
    if (!containerRef.current) {
      console.error("[ExportRenderer] Export failed: Render container not found.");
      onExportComplete();
      return;
    }
    console.log('[ExportRenderer] Starting export render process');
    try {
      console.log('[ExportRenderer] Capturing canvas with html2canvas');
      const canvas = await html2canvas(containerRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      console.log(`[ExportRenderer] Canvas captured: ${canvas.width}x${canvas.height}`);
      
      if (exportOptions.fileFormat === "png") {
        console.log('[ExportRenderer] Exporting as PNG');
        const link = document.createElement("a");
        link.download = `domapus-map-${selectedMetric}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        console.log('[ExportRenderer] PNG export complete');
      } else {
        console.log('[ExportRenderer] Exporting as PDF');
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(`domapus-map-${selectedMetric}.pdf`);
        console.log('[ExportRenderer] PDF export complete');
      }
    } catch (error) {
      console.error("[ExportRenderer] Export failed during screenshot process:", error);
    } finally {
      onExportComplete();
    }
  }, [exportOptions, selectedMetric]);

  const getMetricDisplayName = (metric: string): string => {
    const metricNames: Record<string, string> = { "median-sale-price": "Median Sale Price", "median-list-price": "Median List Price", "median-dom": "Median Days on Market", "inventory": "Inventory", "new-listings": "New Listings", "homes-sold": "Homes Sold", "sale-to-list-ratio": "Sale to List Ratio", "homes-sold-above-list": "Homes Sold Above List", "off-market-2-weeks": "Off Market in 2 Weeks" };
    return metricNames[metric] || metric;
  };
  
  const getRegionDisplayName = (): string => {
    if (exportOptions.regionScope === 'state') return exportOptions.selectedState || "State";
    if (exportOptions.regionScope === 'metro') return exportOptions.selectedMetro || "Metro Area";
    return "United States";
  };
  
  const getCurrentDate = (): string => new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Extract values for the legend
  const metricValues = filteredData
    .map((d) => d[selectedMetric as keyof ZipData] as number)
    .filter((v) => typeof v === 'number');

  return (
    <div ref={containerRef} className="fixed top-0 left-0 w-[1200px] h-[900px] bg-white p-8 flex flex-col font-sans" style={{ transform: "translateX(-9999px)" }}>
      {exportOptions.includeTitle && (
        <header className="text-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">{getMetricDisplayName(selectedMetric)} by ZIP Code</h1>
          <p className="text-lg text-gray-600">{getRegionDisplayName()}, {getCurrentDate()}</p>
        </header>
      )}
      <main className="flex-grow border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
        {filteredGeoJSON && filteredData.length > 0 ? (
          <ExportMap
            filteredData={filteredData}
            geoJSON={filteredGeoJSON}
            selectedMetric={selectedMetric}
            regionScope={exportOptions.regionScope}
            onRenderComplete={handleRenderComplete}
          />
        ) : <div className="flex items-center justify-center h-full text-gray-500">Preparing map data...</div>}
      </main>
      <footer className="pt-4 flex justify-between items-end">
        {exportOptions.includeLegend && (
          <Legend
            selectedMetric={selectedMetric}
            metricValues={metricValues}
          />
        )}
        <div className="text-right">
          <DomapusLogo size="sm" className="mb-1 justify-end" />
          <p className="text-xs text-gray-500">Analytics by Domapus</p>
          <p className="text-xs text-gray-400">Data sourced from Redfin</p>
        </div>
      </footer>
    </div>
  );
}