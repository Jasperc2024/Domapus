import { useState } from "react";
import { Download, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportSidebar, ExportOptions } from "./dashboard/ExportSidebar";
import { ExportPreviewMap } from "./dashboard/ExportPreviewMap";
import { ExportRenderer } from "./dashboard/ExportRenderer";

interface MapExportProps {
  selectedMetric: string;
}

export function MapExport({ selectedMetric }: MapExportProps) {
  const [isExportMode, setIsExportMode] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const states = [
    { code: "CA", name: "California" },
    { code: "NY", name: "New York" },
    { code: "TX", name: "Texas" },
    { code: "FL", name: "Florida" },
    { code: "IL", name: "Illinois" },
    { code: "WA", name: "Washington" },
    // Add more states as needed
  ];

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
      console.error('Export failed:', error);
    }
  };

  const handleCancel = () => {
    setIsExportMode(false);
    setExportOptions(null);
    setIsExporting(false);
  };

  if (isExportMode) {
    return (
      <div className="flex h-screen w-full">
        <ExportSidebar
          selectedMetric={selectedMetric}
          onExport={handleExport}
          onCancel={handleCancel}
          isExporting={isExporting}
        />
        <div className="flex-1">
          <ExportPreviewMap
            selectedMetric={selectedMetric}
            exportOptions={exportOptions || {
              regionScope: 'national',
              fileFormat: 'png',
              includeLegend: true,
              includeTitle: true,
              includeDateLabel: true,
              includeAttribution: true
            }}
          />
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