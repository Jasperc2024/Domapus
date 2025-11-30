import { useState, useMemo, useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportSidebar, ExportOptions } from "./dashboard/ExportSidebar";
import { ExportRenderer } from "./dashboard/ExportRenderer";
import { ZipData } from "./dashboard/map/types";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface MapExportProps {
  allZipData: Record<string, ZipData>;
  fullGeoJSON: GeoJSON.FeatureCollection | null;
  selectedMetric: string;
}

export function MapExport({ allZipData, fullGeoJSON, selectedMetric }: MapExportProps) {
  const [isExportMode, setIsExportMode] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportTimeoutId, setExportTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const isMobile = useIsMobile();

  const { filteredData, filteredGeoJSON } = useMemo(() => {
    if (!exportOptions || Object.keys(allZipData).length === 0 || !fullGeoJSON) {
      return { filteredData: [], filteredGeoJSON: null };
    }
    
    const filteredZips = Object.values(allZipData).filter(zip => {
      if (exportOptions.regionScope === 'state' && exportOptions.selectedState) {
        return zip.state === exportOptions.selectedState;
      }
      if (exportOptions.regionScope === 'metro' && exportOptions.selectedMetro) {
        return zip.parent_metro === exportOptions.selectedMetro;
      }
      return true;
    });

    const filteredZipCodes = new Set(filteredZips.map(z => z.zipCode));
    const filteredFeatures = fullGeoJSON.features.filter(f =>
      filteredZipCodes.has(f.properties?.zipCode)
    );

    return {
      filteredData: filteredZips,
      filteredGeoJSON: { type: "FeatureCollection", features: filteredFeatures } as GeoJSON.FeatureCollection
    };
  }, [allZipData, fullGeoJSON, exportOptions]);

  useEffect(() => {
    return () => {
      if (exportTimeoutId) clearTimeout(exportTimeoutId);
    };
  }, [exportTimeoutId]);

  const handleStartExport = (options: ExportOptions) => {
    setExportOptions(options);
    setIsExporting(true);
    
    // Set timeout for 60 seconds
    const timeoutId = setTimeout(() => {
      if (isExporting) {
        setIsExporting(false);
        toast({
          title: "Export Timeout",
          description: "Export took too long and was cancelled. Please try again.",
          variant: "destructive",
        });
      }
    }, 60000);
    
    setExportTimeoutId(timeoutId);
  };

  const handleExportComplete = () => {
    if (exportTimeoutId) clearTimeout(exportTimeoutId);
    setIsExporting(false);
    setExportOptions(null);
    toast({
      title: "Export Complete",
      description: "Your map has been downloaded successfully.",
    });
    // Keep in export mode so user can export again with different settings
  };

  const handleCancelExport = () => {
    if (exportTimeoutId) clearTimeout(exportTimeoutId);
    setIsExportMode(false);
    setIsExporting(false);
    setExportOptions(null);
  };

  if (isExportMode) {
    return (
      <>
        <ExportSidebar
          allZipData={allZipData}
          fullGeoJSON={fullGeoJSON}
          selectedMetric={selectedMetric}
          isExporting={isExporting}
          onExport={handleStartExport}
          onCancel={handleCancelExport}
        />
        
        {isExporting && (
          <>
            {/* Processing overlay */}
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
              <div className="bg-white p-8 rounded-lg shadow-lg border text-center space-y-4">
                <div role="progressbar" aria-label="Generating export" className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                <div>
                  <h3 className="font-semibold text-lg">Generating Your Export</h3>
                  <p className="text-sm text-gray-600">
                    Please wait while we process your map...
                  </p>
                </div>
              </div>
            </div>
            
            {/* Hidden renderer */}
            <ExportRenderer
              filteredData={filteredData}
              filteredGeoJSON={filteredGeoJSON}
              selectedMetric={selectedMetric}
              exportOptions={exportOptions!}
              onExportComplete={handleExportComplete}
            />
          </>
        )}
      </>
    );
  }

  // Export button
  return (
  <Button variant="outline" size="sm" onClick={() => setIsExportMode(true)}>
    <Download className="h-4 w-4 mr-2" />
    {!isMobile && <span>Export</span>}
  </Button>
);
}