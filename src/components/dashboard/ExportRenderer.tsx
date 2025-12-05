import { useRef, useCallback, useMemo } from "react";
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
      // High DPI scale: 4x for crisp output
      const scale = 4;
      console.log(`[ExportRenderer] Capturing canvas with html2canvas at ${scale}x scale`);
      
      const canvas = await html2canvas(containerRef.current, {
        scale, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      console.log(`[ExportRenderer] Canvas captured: ${canvas.width}x${canvas.height}`);
      
      if (exportOptions.fileFormat === "png") {
        console.log('[ExportRenderer] Exporting as PNG');
        const link = document.createElement("a");
        link.download = `domapus-map-${selectedMetric}.png`;
        link.href = canvas.toDataURL("image/png", 1.0);
        link.click();
      } else {
        console.log('[ExportRenderer] Exporting as high-DPI PDF');
        const imgData = canvas.toDataURL("image/png", 1.0);
        
        // PDF at 300 DPI: convert pixel dimensions to points (72 DPI)
        // Scale factor from screen (96 DPI * render scale) to PDF points
        const pdfWidth = canvas.width / scale * 0.75; // Convert to points (72/96)
        const pdfHeight = canvas.height / scale * 0.75;
        
        const pdf = new jsPDF({ 
          orientation: pdfWidth > pdfHeight ? "landscape" : "portrait", 
          unit: "pt", 
          format: [pdfWidth, pdfHeight] 
        });
        
        // Add high-res image scaled to fit PDF page
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
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
      "median_sale_price": "Median Sale Price",
      "median_ppsf": "Median Price per Sq Ft",
      "avg_sale_to_list_ratio": "Sale-to-List Ratio",
      "median_dom": "Median Days on Market",
    };
    return metricNames[metric] || metric.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };
  
  const getRegionDisplayName = (): string => {
    if (exportOptions.regionScope === 'state') return exportOptions.selectedState || "State";
    if (exportOptions.regionScope === 'metro') return exportOptions.selectedMetro || "Metro Area";
    return "United States";
  };
  
  const getCurrentDate = (): string => new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Extract values for the legend
  const metricValues = useMemo(() => {
    const dataKey = selectedMetric.replace(/-/g, "_") as keyof ZipData;
    return filteredData
      .map((d) => d[dataKey] as number)
      .filter((v) => typeof v === "number" && v > 0);
  }, [filteredData, selectedMetric]);

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
          <>
            <ExportMap
              filteredData={filteredData}
              geoJSON={filteredGeoJSON}
              selectedMetric={selectedMetric}
              regionScope={exportOptions.regionScope}
              onRenderComplete={handleRenderComplete}
            />
            {exportOptions.includeLegend && (
              <div className="absolute bottom-6 right-6 w-72">
                <Legend
                  selectedMetric={selectedMetric}
                  metricValues={metricValues}
                  isExport={true}
                />
              </div>
            )}
          </>
        ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-xl font-medium">
                Preparing map data...
            </div>
        )}
      </main>

      <footer className="pt-6 flex justify-end items-end">
        <div className="text-right">
          <DomapusLogo size="lg" className="mb-2 justify-end" />
          <p className="text-sm text-gray-600 font-medium">Market Analytics by Domapus</p>
          <p className="text-xs text-gray-400">Data sourced from Redfin</p>
        </div>
      </footer>
    </div>
  );
}