import { useState, useEffect } from "react";
import React, { Suspense } from "react";
import { useDataWorker } from "@/hooks/useDataWorker";
import { ZipData } from "./map/types";
import pako from "pako";
import { MapExport } from "@/components/MapExport";

// Import all necessary components
import { TopBar } from "./TopBar";
import { MapLibreMap } from "./MapLibreMap";
import { Legend } from "./Legend";
import { SponsorBanner } from "./SponsorBanner";
import { Sidebar } from "./Sidebar";

// Type Definitions
export type MetricType = "median-sale-price" | "median-list-price" | "median-dom" | "inventory" | "new-listings" | "homes-sold" | "sale-to-list-ratio" | "homes-sold-above-list" | "off-market-2-weeks";
interface DataPayload {
  last_updated_utc: string;
  zip_codes: Record<string, ZipData>;
  bounds: { min: number; max: number; };
}

export function HousingDashboard() {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("median-sale-price");
  const [selectedZip, setSelectedZip] = useState<ZipData | null>(null);
  const [searchZip, setSearchZip] = useState<string>("");
  const [zipData, setZipData] = useState<Record<string, ZipData>>({});
  const [dataBounds, setDataBounds] = useState<{ min: number; max: number } | null>(null);
  const [fullGeoJSON, setFullGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSponsorBanner, setShowSponsorBanner] = useState(false);
  
  const { processData, isLoading, progress } = useDataWorker();

  useEffect(() => {
    const loadInitialData = async () => {
      const result = await processData({
        type: 'LOAD_AND_PROCESS_DATA',
        data: { url: "/data/zip-data.json.gz", selectedMetric: 'median_sale_price' }
      }) as DataPayload;

      if (result) {
        setZipData(result.zip_codes);
        setDataBounds(result.bounds);
        setLastUpdated(result.last_updated_utc);
      }

      const geoResponse = await fetch("/data/us-zip-codes.geojson.gz");
      const geoBuffer = await geoResponse.arrayBuffer();
      const geoDecompressed = pako.ungzip(new Uint8Array(geoBuffer), { to: 'string' });
      const geoData = JSON.parse(geoDecompressed);
      setFullGeoJSON(geoData);
    };

    loadInitialData();
    const timer = setTimeout(() => setShowSponsorBanner(true), 30000);
    return () => clearTimeout(timer);
  }, [processData]);
  
  // Debugging log to confirm data loading
  useEffect(() => {
    if (Object.keys(zipData).length > 0 && fullGeoJSON) {
      console.log("✅ [HousingDashboard] Master data loaded successfully.");
      console.log(`   - Loaded ${Object.keys(zipData).length} ZIP code records.`);
      console.log(`   - Loaded ${fullGeoJSON.features.length} GeoJSON features.`);
    }
  }, [zipData, fullGeoJSON]);

  const handleZipSelect = (zip: ZipData) => { setSelectedZip(zip); setSidebarOpen(true); };
  const toggleSidebarCollapse = () => { setSidebarCollapsed(!sidebarCollapsed); };
  
  return (
    <div className="w-full h-screen bg-dashboard-bg overflow-hidden flex flex-col">
      {showSponsorBanner && <SponsorBanner onClose={() => setShowSponsorBanner(false)} />}
      
      <TopBar selectedMetric={selectedMetric} onMetricChange={setSelectedMetric} onSearch={setSearchZip} lastUpdated={lastUpdated}>
        <MapExport allZipData={zipData} fullGeoJSON={fullGeoJSON} selectedMetric={selectedMetric} />
      </TopBar>
      
      <div className="flex flex-1 relative">
        {sidebarOpen && <Sidebar isOpen={sidebarOpen} isCollapsed={sidebarCollapsed} zipData={selectedZip} allZipData={zipData} onClose={() => setSidebarOpen(false)} onToggleCollapse={toggleSidebarCollapse} />}

        <div className={`flex-1 relative transition-all duration-300 ${sidebarOpen ? (sidebarCollapsed ? "ml-16" : "ml-96") : "ml-0"}`}>
          <div className="absolute inset-0">
            <MapLibreMap
              selectedMetric={selectedMetric}
              onZipSelect={handleZipSelect}
              searchZip={searchZip}
              zipData={zipData}
              colorScaleDomain={dataBounds ? [dataBounds.min, dataBounds.max] : null}
              isLoading={isLoading || !fullGeoJSON}
              progress={progress}
              processData={processData}
            />
          </div>
          <div className="absolute bottom-4 right-4 w-64 z-[1000] pointer-events-auto">
            <Legend selectedMetric={selectedMetric} colorScaleDomain={dataBounds ? [dataBounds.min, dataBounds.max] : null} />
          </div>
        </div>
      </div>
    </div>
  );
}