import { useState, useEffect } from "react";
import { useDataWorker } from "@/hooks/useDataWorker";
import { ZipData } from "./map/types";
import { MapExport } from "@/components/MapExport";
import { buildSpatialIndex } from "@/lib/spatial-index";

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
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("median_sale_price");
  const [selectedZip, setSelectedZip] = useState<ZipData | null>(null);
  const [searchZip, setSearchZip] = useState<string>("");
  const [zipData, setZipData] = useState<Record<string, ZipData>>({});
  const [dataBounds, setDataBounds] = useState<{ min: number; max: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed] = useState(false);
  const [showSponsorBanner, setShowSponsorBanner] = useState(false);
  
  const { processData, isLoading } = useDataWorker();

  useEffect(() => {
    let isMounted = true;
    let hasRun = false;
    
    const loadInitialData = async () => {
      if (hasRun) return;
      hasRun = true;
      console.log('[HousingDashboard] Starting initial data load');
      
      const dataUrl = new URL(`${BASE_PATH}data/zip-data.json`, window.location.origin).href;
      console.log('[HousingDashboard] Data URL:', dataUrl);

      try {
        console.log('[HousingDashboard] Calling processData for ZIP data');
        const result = await processData({
          type: 'LOAD_AND_PROCESS_DATA',
          data: { url: dataUrl, selectedMetric: 'median_sale_price' }
        }) as DataPayload;

        if (!isMounted) {
          console.log('[HousingDashboard] Component unmounted, aborting');
          return;
        }
        
        if (result) {
          console.log(`[HousingDashboard] ZIP data loaded: ${Object.keys(result.zip_codes).length} ZIPs`);
          setZipData(result.zip_codes);
          setDataBounds(result.bounds);
          
          // Build spatial index for efficient lookups (async, non-blocking)
          setTimeout(() => {
            buildSpatialIndex(result.zip_codes);
          }, 100);
        }

        console.log('[HousingDashboard] Initial data load complete');
      } catch (error) {
        console.error("[HousingDashboard] Failed to load initial data:", error);
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
  
  const handleZipSelect = (zip: ZipData) => { 
    console.log('[HousingDashboard] ZIP selected:', zip.zipCode);
    setSelectedZip(zip); 
    setSidebarOpen(true); 
  };
  const [isExportMode, setIsExportMode] = useState(false);
  
  return (
    <div className="w-full h-screen bg-dashboard-bg overflow-hidden flex flex-col">
      {showSponsorBanner && <SponsorBanner onClose={() => setShowSponsorBanner(false)} />}
      <TopBar selectedMetric={selectedMetric} onMetricChange={setSelectedMetric} onSearch={setSearchZip}>
        <MapExport 
          allZipData={zipData} 
          selectedMetric={selectedMetric}
          onExportModeChange={setIsExportMode}
        />
      </TopBar>
      <div className="flex flex-1 relative min-h-[400px]">
        {sidebarOpen && <Sidebar isOpen={sidebarOpen} isCollapsed={sidebarCollapsed} zipData={selectedZip} allZipData={zipData} onClose={() => setSidebarOpen(false)} />}
        <div className="flex-1 relative">
          <div className="absolute inset-0 min-h-[400px]">
            <MapLibreMap
              selectedMetric={selectedMetric}
              onZipSelect={handleZipSelect}
              searchZip={searchZip}
              zipData={zipData}
              colorScaleDomain={dataBounds ? [dataBounds.min, dataBounds.max] : null}
              isLoading={isLoading}
              processData={processData}
            />
          </div>
          {!isExportMode && (
            <div className="absolute bottom-4 right-4 w-64 z-[1000] pointer-events-auto">
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
