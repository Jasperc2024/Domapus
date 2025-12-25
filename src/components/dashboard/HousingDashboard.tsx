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
  
  const { processData, isLoading } = useDataWorker();

  useEffect(() => {
    let isMounted = true;
    let hasRun = false;
    
    const loadInitialData = async () => {
      if (hasRun) return;
      hasRun = true;
      console.log('[HousingDashboard] Starting initial data load');
      
      const dataUrl = new URL(`${BASE_PATH}data/zip-data.json`, window.location.origin).href;

      try {
        const result = await processData({
          type: 'LOAD_AND_PROCESS_DATA',
          data: { url: dataUrl, selectedMetric: 'zhvi' }
        }) as DataPayload;

        if (!isMounted) return;
        
        if (result) {
          console.log(`[HousingDashboard] ZIP data loaded: ${Object.keys(result.zip_codes).length} ZIPs`);
          setZipData(result.zip_codes);
          setDataBounds(result.bounds);
          
          // Build spatial index for efficient lookups
          setTimeout(() => {
            buildSpatialIndex(result.zip_codes);
          }, 100);
        }
      } catch (error: any) {
        console.error("[HousingDashboard] Failed to load initial data:", error);
        trackError("dashboard_data_load_failed", error?.message || "Failed to load initial data");
      }
    };
    loadInitialData();
    const timer = setTimeout(() => setShowSponsorBanner(true), 30000);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
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
