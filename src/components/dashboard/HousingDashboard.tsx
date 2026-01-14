import { useState, useEffect, useCallback } from "react";
import { useDataWorker } from "@/hooks/useDataWorker";
import { ZipData } from "./map/types";
import { MapExport } from "@/components/MapExport";
import { buildSpatialIndex } from "@/lib/spatial-index";
import { useIsMobile } from "@/hooks/use-mobile";
import { trackError } from "@/lib/analytics";
import { TopBar } from "./TopBar";
import { MapLibreMap } from "./MapLibreMap";
import { Legend } from "./Legend";
import { SponsorBanner } from "./SponsorBanner";
import { Sidebar } from "./Sidebar";
import { MetricType } from "./MetricSelector";

interface DataPayload { 
  last_updated_utc: string;
  zip_codes: Record<string, ZipData>;
  bounds: { min: number; max: number; };
}

const BASE_PATH = import.meta.env.BASE_URL;

export function HousingDashboard() {
  const isMobile = useIsMobile();
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("zhvi");
  const [selectedZip, setSelectedZip] = useState<ZipData | null>(null);
  const [searchZip, setSearchZip] = useState<string>("");
  const [searchTrigger, setSearchTrigger] = useState<number>(0);
  const [zipData, setZipData] = useState<Record<string, ZipData>>({});
  const [dataBounds, setDataBounds] = useState<{ min: number; max: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSponsorBanner, setShowSponsorBanner] = useState(false);
  const [isExportMode, setIsExportMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const { processData, isLoading } = useDataWorker();

  useEffect(() => {
    let isMounted = true;
    let hasRun = false;
    
    const loadInitialData = async () => {
      if (hasRun) return;
      hasRun = true;
      const dataUrl = new URL(`${BASE_PATH}data/zip-data.json`, window.location.origin).href;

      try {
        setLoadError(null);
        const result = await processData({
          type: 'LOAD_AND_PROCESS_DATA',
          data: { url: dataUrl, selectedMetric: 'zhvi' }
        }) as DataPayload;

        if (!isMounted) return;
        
        if (result) {
          setZipData(result.zip_codes);
          setDataBounds(result.bounds);
          
          // Build spatial index for efficient lookups
          setTimeout(() => {
            buildSpatialIndex(result.zip_codes);
          }, 100);
        }
      } catch (error: any) {
        console.error("[HousingDashboard] Failed to load initial data:", error);
        const errorMessage = error?.message || "Failed to load data";
        setLoadError(errorMessage);
        trackError("dashboard_data_load_failed", errorMessage);
      }
    };
    loadInitialData();
    ///const timer = setTimeout(() => setShowSponsorBanner(true), 30000);
    
    return () => {
      isMounted = false;
      ///clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable search handler that updates both zip and trigger
  const handleSearch = useCallback((zip: string, trigger: number) => {
    setSearchZip(zip);
    setSearchTrigger(trigger);
  }, []);
  
  const handleZipSelect = useCallback((zip: ZipData) => { 
    setSelectedZip(zip); 
    setSidebarOpen(true); 
  }, []);
  
  // Show error state if data failed to load
  if (loadError) {
    return (
      <div className="w-full h-screen bg-dashboard-bg flex items-center justify-center">
        <div className="bg-card p-8 rounded-lg shadow-lg max-w-md text-center">
          <div className="text-destructive text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Unable to Load Data</h2>
          <p className="text-muted-foreground mb-4">{loadError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-dashboard-bg overflow-hidden flex flex-col">
      {showSponsorBanner && <SponsorBanner onClose={() => setShowSponsorBanner(false)} />}
      <TopBar
        selectedMetric={selectedMetric}
        onMetricChange={setSelectedMetric}
        onSearch={handleSearch}
        hideMobileControls={isMobile && sidebarOpen}
      >
        <MapExport 
          allZipData={zipData} 
          selectedMetric={selectedMetric}
          onExportModeChange={setIsExportMode}
        />
      </TopBar>
      <div className="flex flex-1 relative h-full min-h-[400px]">
        {sidebarOpen && (
          <Sidebar 
            isOpen={sidebarOpen} 
            zipData={selectedZip} 
            allZipData={zipData} 
            onClose={() => setSidebarOpen(false)} 
          />
        )}
        <div className="flex-1 relative">
          <div className="absolute inset-0 min-h-[400px]">
            <MapLibreMap
              selectedMetric={selectedMetric}
              onZipSelect={handleZipSelect}
              searchZip={searchZip}
              searchTrigger={searchTrigger}
              zipData={zipData}
              colorScaleDomain={dataBounds ? [dataBounds.min, dataBounds.max] : null}
              isLoading={isLoading}
              processData={processData}
            />
          </div>
          {!isExportMode && !(isMobile && sidebarOpen) && (
            <div className={`absolute ${isMobile ? 'top-4 left-4' : 'bottom-4 right-4'} ${isMobile ? 'w-auto' : 'w-64'} z-[10] pointer-events-auto`}>
              <Legend
                selectedMetric={selectedMetric}
                metricValues={Object.values(zipData)
                  .map(d => d[selectedMetric] ?? 0)
                  .filter(v => v > 0)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
