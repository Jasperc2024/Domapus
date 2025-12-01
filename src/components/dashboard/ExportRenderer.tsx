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
      // Added slightly higher scale for better text clarity in PDF
      const canvas = await html2canvas(containerRef.current, {
        scale: 3, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      console.log(`[ExportRenderer] Canvas captured: ${canvas.width}x${canvas.height}`);
      
      if (exportOptions.fileFormat === "png") {
        console.log('[ExportRenderer] Exporting as PNG');
        const link = document.createElement("a");
        link.download = `domapus-map-${selectedMetric}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        console.log('[ExportRenderer] Exporting as PDF');
        // Calculate PDF dimensions to fit the image exactly
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ 
            orientation: "landscape", 
            unit: "px", 
            format: [canvas.width, canvas.height] 
        });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(`domapus-map-${selectedMetric}.pdf`);
      }
    } catch (error) {
      console.error("[ExportRenderer] Export failed during screenshot process:", error);
    } finally {
      onExportComplete();
    }
  }, [exportOptions, selectedMetric, onExportComplete]);

  const getMetricDisplayName = (metric: string): string => {
    const metricNames: Record<string, string> = { 
        "median-sale-price": "Median Sale Price", 
        "median-list-price": "Median List Price", 
        "median-dom": "Median Days on Market", 
        "inventory": "Inventory", 
        "new-listings": "New Listings", 
        "homes-sold": "Homes Sold", 
        "sale-to-list-ratio": "Sale to List Ratio", 
        "homes-sold-above-list": "Homes Sold Above List", 
        "off-market-2-weeks": "Off Market in 2 Weeks" 
    };
    return metricNames[metric] || metric.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };
  
  const getRegionDisplayName = (): string => {
    if (exportOptions.regionScope === 'state') return exportOptions.selectedState || "State";
    if (exportOptions.regionScope === 'metro') return exportOptions.selectedMetro || "Metro Area";
    return "United States";
  };
  
  const getCurrentDate = (): string => new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Helper: Convert kebab-case (url param) to snake_case (data key)
  // e.g., 'median-sale-price' -> 'median_sale_price'
  const getDataKey = (metric: string): keyof ZipData => {
    return metric.replace(/-/g, '_') as keyof ZipData;
  };

  // Extract values for the legend using the correct data key
  const metricValues = filteredData
    .map((d) => d[getDataKey(selectedMetric)] as number)
    .filter((v) => typeof v === 'number');

  return (
    <div 
        ref={containerRef} 
        className="fixed top-0 left-0 w-[1200px] h-[900px] bg-white p-8 flex flex-col font-sans" 
        style={{ transform: "translateX(-9999px)" }} // Keep off-screen
    >
      {exportOptions.includeTitle && (
        <header className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{getMetricDisplayName(selectedMetric)} by ZIP Code</h1>
          <p className="text-xl text-gray-600 font-medium">{getRegionDisplayName()} • {getCurrentDate()}</p>
        </header>
      )}

      <main className="flex-grow border border-gray-200 rounded-xl overflow-hidden bg-gray-50 relative shadow-sm">
        {filteredGeoJSON && filteredData.length > 0 ? (
          <ExportMap
            filteredData={filteredData}
            geoJSON={filteredGeoJSON}
            selectedMetric={selectedMetric}
            regionScope={exportOptions.regionScope}
            onRenderComplete={handleRenderComplete}
          />
        ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-xl font-medium">
                Preparing map data...
            </div>
        )}
      </main>

      <footer className="pt-6 flex justify-between items-end">
        {exportOptions.includeLegend && (
          <div className="min-w-[300px]">
            <Legend
              selectedMetric={selectedMetric}
              metricValues={metricValues}
              isExport={true} // New prop to signal clean styling
            />
          </div>
        )}
        <div className="text-right">
          <DomapusLogo size="lg" className="mb-2 justify-end" />
          <p className="text-sm text-gray-600 font-medium">Market Analytics by Domapus</p>
          <p className="text-xs text-gray-400">Data sourced from Redfin</p>
        </div>
      </footer>
    </div>
  );
}