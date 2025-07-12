import { useRef, useState } from "react";
import { ExportOptions } from "./ExportSidebar";
import { ExportPreviewMap } from "./ExportPreviewMap";
import { ExportLegend } from "./ExportLegend";
import { DomapusLogo } from "@/components/ui/domapus-logo";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ExportRendererProps {
  selectedMetric: string;
  exportOptions: ExportOptions;
  onExportComplete: (success: boolean, error?: string) => void;
}

export function ExportRenderer({
  selectedMetric,
  exportOptions,
  onExportComplete,
}: ExportRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(false);

  const getMetricDisplayName = (metric: string) => {
    const metricNames: Record<string, string> = {
      "median-sale-price": "Median Sale Price",
      "median-list-price": "Median List Price",
      "median-dom": "Median Days on Market",
      inventory: "Inventory",
      "new-listings": "New Listings",
      "homes-sold": "Homes Sold",
      "sale-to-list-ratio": "Sale to List Ratio",
      "homes-sold-above-list": "Homes Sold Above List",
      "off-market-2-weeks": "Off Market in 2 Weeks",
    };
    return metricNames[metric] || metric;
  };

  const getRegionDisplayName = () => {
    if (exportOptions.regionScope === "national") return "United States";
    if (exportOptions.regionScope === "state")
      return exportOptions.selectedState;
    if (exportOptions.regionScope === "metro")
      return exportOptions.selectedMetro;
    return "";
  };

  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const renderToImage = async () => {
    if (!containerRef.current) {
      onExportComplete(false, "Container not found");
      return;
    }

    setIsRendering(true);

    try {
      // Wait for map to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const canvas = await html2canvas(containerRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        width: 1200,
        height: 900,
        onclone: (clonedDoc) => {
          // Ensure map is visible in cloned document
          const clonedContainer = clonedDoc.querySelector(
            "[data-export-container]",
          ) as HTMLElement;
          if (clonedContainer) {
            clonedContainer.style.display = "block";
            clonedContainer.style.visibility = "visible";
          }
        },
      });

      if (exportOptions.fileFormat === "png") {
        // Download as PNG
        const link = document.createElement("a");
        link.download = `housing-market-${exportOptions.regionScope}-${selectedMetric}-${new Date().toISOString().split("T")[0]}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        // Download as PDF
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "px",
          format: [canvas.width / 2, canvas.height / 2],
        });

        pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
        pdf.save(
          `housing-market-${exportOptions.regionScope}-${selectedMetric}-${new Date().toISOString().split("T")[0]}.pdf`,
        );
      }

      onExportComplete(true);
    } catch (error: any) {
      console.error("Export failed:", error);
      onExportComplete(false, error.message || "Export failed");
    } finally {
      setIsRendering(false);
    }
  };

  // Start rendering when component mounts
  useState(() => {
    const timer = setTimeout(renderToImage, 1000);
    return () => clearTimeout(timer);
  });

  return (
    <div
      ref={containerRef}
      data-export-container
      className="fixed top-0 left-0 w-[1200px] h-[900px] bg-white"
      style={{
        zIndex: -1000,
        transform: "translateX(-9999px)",
        position: "absolute",
      }}
    >
      {/* Title */}
      {exportOptions.includeTitle && (
        <div className="px-8 pt-6 pb-2">
          <h1 className="text-2xl font-bold text-gray-900 text-center">
            {getMetricDisplayName(selectedMetric)} by ZIP Code -{" "}
            {getRegionDisplayName()}, {getCurrentDate()}
          </h1>
        </div>
      )}

      {/* Map Container */}
      <div className="flex-1 px-8 pb-4">
        <div className="w-full h-[600px] border border-gray-300 rounded">
          <ExportPreviewMap
            selectedMetric={selectedMetric}
            exportOptions={exportOptions}
            mapRef={mapRef}
          />
        </div>
      </div>

      {/* Legend and Branding */}
      <div className="px-8 pb-4 flex justify-between items-end">
        {exportOptions.includeLegend && (
          <ExportLegend
            selectedMetric={selectedMetric}
            exportOptions={exportOptions}
          />
        )}

        {/* Domapus Logo and Branding */}
        <div className="text-right">
          <DomapusLogo size="sm" className="mb-1 justify-end" />
          <p className="text-xs text-gray-500">Housing Market Analytics</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 pb-6 mt-auto">
        <div className="border-t border-gray-300 pt-4 text-center space-y-1">
          {exportOptions.includeDateLabel && (
            <p className="text-sm text-gray-600">
              Data as of {getCurrentDate()}
            </p>
          )}
          {exportOptions.includeAttribution && (
            <p className="text-xs text-gray-500">
              Data sourced from Redfin • Created with Domapus
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
