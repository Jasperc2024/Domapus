import { useState, useMemo } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportSidebar, ExportOptions } from "./dashboard/ExportSidebar";
import { ExportRenderer } from "./dashboard/ExportRenderer";
import { ZipData } from "./dashboard/map/types";

// --- NEW: Define the props this component now accepts from its parent ---
interface MapExportProps {
  allZipData: Record<string, ZipData>;
  fullGeoJSON: GeoJSON.FeatureCollection | null;
  selectedMetric: string;
}

export function MapExport({ allZipData, fullGeoJSON, selectedMetric }: MapExportProps) {
  // UI state for managing the export flow (no changes needed here)
  const [isExportMode, setIsExportMode] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // --- NEW: This is the "brain" of the export feature, moved here from HousingDashboard ---
  // It performs the high-speed, in-memory filtering.
  const { filteredData, filteredGeoJSON } = useMemo(() => {
    // Don't do any work unless the user has actually started the export process
    if (!exportOptions || Object.keys(allZipData).length === 0 || !fullGeoJSON) {
      return { filteredData: [], filteredGeoJSON: null };
    }
    
    // 1. Filter the raw data based on the user's selected region
    const filteredZips = Object.values(allZipData).filter(zip => {
      if (exportOptions.regionScope === 'state' && exportOptions.selectedState) {
        return zip.state === exportOptions.selectedState;
      }
      if (exportOptions.regionScope === 'metro' && exportOptions.selectedMetro) {
        return zip.parent_metro === exportOptions.selectedMetro;
      }
      return true; // National scope, include all zips
    });

    // 2. Filter the master GeoJSON to only include the shapes for the filtered data
    const filteredZipCodes = new Set(filteredZips.map(z => z.zipCode));
    const filteredFeatures = fullGeoJSON.features.filter(f =>
      filteredZipCodes.has(f.properties?.zipCode)
    );

    return {
      filteredData: filteredZips,
      filteredGeoJSON: { type: "FeatureCollection", features: filteredFeatures } as GeoJSON.FeatureCollection
    };
  }, [allZipData, fullGeoJSON, exportOptions]);

  // Event handlers to control the export workflow
  const handleStartExport = (options: ExportOptions) => {
    setExportOptions(options);
    setIsExporting(true);
  };

  const handleExportComplete = () => {
    setIsExporting(false);
    setIsExportMode(false);
    setExportOptions(null);
  };

  const handleCancelExport = () => {
    setIsExportMode(false);
    setIsExporting(false);
    setExportOptions(null);
  };

  if (isExportMode) {
    return (
      // This div now represents the full-screen export interface
      <div className="fixed inset-0 bg-gray-100 z-50 flex">
        <ExportSidebar
          allZipData={allZipData} // Pass the full data down for the dropdowns
          isExporting={isExporting}
          onExport={handleStartExport}
          onCancel={handleCancelExport}
        />
        
        {/* The main area is a placeholder, as the real work happens in the hidden renderer */}
        <div className="flex-1 flex items-center justify-center p-8">
            <div className="bg-white p-8 rounded-lg shadow-lg border text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              <div>
                <h3 className="font-semibold text-lg">Generating Your Export</h3>
                <p className="text-sm text-gray-600">
                  Please keep this window open. Your download will begin shortly.
                </p>
              </div>
            </div>
        </div>
        
        {/* The ExportRenderer is now only rendered when the user has confirmed their options */}
        {isExporting && (
          <ExportRenderer
            filteredData={filteredData}
            filteredGeoJSON={filteredGeoJSON}
            selectedMetric={selectedMetric}
            exportOptions={exportOptions!}
            onExportComplete={handleExportComplete}
          />
        )}
      </div>
    );
  }

  // This is the initial "Export" button
  return (
    <Button variant="outline" size="sm" onClick={() => setIsExportMode(true)}>
      <Download className="h-4 w-4 mr-2" />
      Export
    </Button>
  );
}