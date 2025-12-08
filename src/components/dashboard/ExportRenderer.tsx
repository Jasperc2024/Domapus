import { useRef, useCallback, useMemo, useEffect, useState } from "react";
import { ExportPreviewMap } from "./ExportPreviewMap";
import { Legend } from "./Legend";
import { DomapusLogo } from "@/components/ui/domapus-logo";
import { ZipData } from "./map/types";
import { ExportOptions } from "./ExportSidebar";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ExportRendererProps {
  filteredData: ZipData[];
  selectedMetric: string;
  exportOptions: ExportOptions;
  onExportComplete: () => void;
}

export function ExportRenderer({
  filteredData,
  selectedMetric,
  exportOptions,
  onExportComplete,
}: ExportRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);

  const handleMapRenderComplete = useCallback(() => {
    console.log('[ExportRenderer] Map render complete');
    setMapReady(true);
  }, []);

  // Wait for map to be ready, then capture
  useEffect(() => {
    if (!mapReady || !containerRef.current) return;

    const captureExport = async () => {
      console.log('[ExportRenderer] Starting export capture');
      
      // Give a small delay for final paint
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        const scale = 4;
        console.log(`[ExportRenderer] Capturing canvas at ${scale}x scale`);
        
        const canvas = await html2canvas(containerRef.current!, {
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
          
          const pdfWidth = canvas.width / scale * 0.75;
          const pdfHeight = canvas.height / scale * 0.75;
          
          const pdf = new jsPDF({ 
            orientation: pdfWidth > pdfHeight ? "landscape" : "portrait", 
            unit: "pt", 
            format: [pdfWidth, pdfHeight] 
          });
          
          pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
          pdf.save(`domapus-map-${selectedMetric}.pdf`);
        }
      } catch (error) {
        console.error("[ExportRenderer] Export failed:", error);
      } finally {
        onExportComplete();
      }
    };

    captureExport();
  }, [mapReady, exportOptions, selectedMetric, onExportComplete]);

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

  const metricValues = useMemo(() => {
    return filteredData
      .map((d) => d[selectedMetric as keyof ZipData] as number)
      .filter((v) => typeof v === "number" && v > 0);
  }, [filteredData, selectedMetric]);

  return (
    <div 
        ref={containerRef} 
        className="fixed top-0 left-0 w-[1200px] h-[900px] bg-white p-8 flex flex-col font-sans" 
        style={{ transform: "translateX(-9999px)" }}
    >
      {exportOptions.includeTitle && (
        <header className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{getMetricDisplayName(selectedMetric)} by ZIP Code</h1>
          <p className="text-xl text-gray-600 font-medium">{getRegionDisplayName()} • {getCurrentDate()}</p>
        </header>
      )}

      <main className="flex-grow border border-gray-200 rounded-xl overflow-hidden bg-gray-50 relative shadow-sm">
        {filteredData.length > 0 ? (
          <>
            <ExportPreviewMap
              filteredData={filteredData}
              selectedMetric={selectedMetric}
              regionScope={exportOptions.regionScope}
              onRenderComplete={handleMapRenderComplete}
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
