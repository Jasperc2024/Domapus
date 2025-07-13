import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportSidebar, ExportOptions } from "./dashboard/ExportSidebar";
import { ExportPreviewMap } from "./dashboard/ExportPreviewMap";
import { ExportRenderer } from "./dashboard/ExportRenderer";

interface MapExportProps {
  selectedMetric: string;
}

export function MapExport({ selectedMetric }: MapExportProps) {
  const [isExportMode, setIsExportMode] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions | null>(
    null,
  );
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = (options: ExportOptions) => {
    setExportOptions(options);
    setIsExporting(true);
  };

  const handleExportComplete = (success: boolean, error?: string) => {
    setIsExporting(false);
    if (success) {
      setIsExportMode(false);
      setExportOptions(null);
    } else if (error) {
      console.error("Export failed:", error);
    }
  };

  const handleCancel = () => {
    setIsExportMode(false);
    setExportOptions(null);
    setIsExporting(false);
  };

  if (isExportMode) {
    return (
      <div className="relative flex h-screen w-full">
        <ExportSidebar
          selectedMetric={selectedMetric}
          onExport={handleExport}
          onCancel={handleCancel}
          isExporting={isExporting}
        />
        <div className="flex-1 relative">
          <ExportPreviewMap
            selectedMetric={selectedMetric}
            exportOptions={
              exportOptions || {
                regionScope: "national",
                fileFormat: "png",
                includeLegend: true,
                includeTitle: true,
                includeDateLabel: true,
                includeAttribution: true,
              }
            }
          />
          {/* Centered loading overlay */}
          {isExporting && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg border text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
                <div>
                  <h3 className="font-semibold text-lg">Generating Export</h3>
                  <p className="text-sm text-gray-600">
                    Please wait while we prepare your map...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        {exportOptions && isExporting && (
          <ExportRenderer
            selectedMetric={selectedMetric}
            exportOptions={exportOptions}
            onExportComplete={handleExportComplete}
          />
        )}
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setIsExportMode(true)}
      aria-label="Export map"
    >
      <Download className="h-4 w-4 mr-2" aria-hidden="true" />
      Export Map
    </Button>
  );
}
