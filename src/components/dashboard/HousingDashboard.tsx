// src/components/dashboard/HousingDashboard.tsx
// FINAL, COMPLETE, AND WORKING VERSION

import { useState, useEffect, Suspense } from "react";
import { useDataWorker } from "@/hooks/useDataWorker";
import { ZipData } from "./map/types"; // --- FIX 1: Remove obsolete CityData import ---
import pako from "pako";
import { MapExport } from "@/components/MapExport"; // Corrected path assumption

// Import all necessary components
import { TopBar } from "./TopBar";
import { MapLibreMap } from "./MapLibreMap";
import { Legend } from "./Legend";
import { SponsorBanner } from "./SponsorBanner";
import { Sidebar } from "./Sidebar";

// Type Definitions
export type MetricType = "median-sale-price" | "median-list-price" | "median-dom" | "inventory" | "new-listings" | "homes-sold" | "sale-to-list-ratio" | "homes-sold-above-list" | "off-market-2-weeks";
// --- FIX 2: Simplify the data payload to match the new worker ---
interface DataPayload {
  zipData: Record<string, ZipData>;
  bounds: { min: number; max: number; };
}

export function HousingDashboard() {
  // Core App State
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("median-sale-price");
  const [selectedZip, setSelectedZip] = useState<ZipData | null>(null);
  const [searchZip, setSearchZip] = useState<string>("");

  // Master Data State
  const [zipData, setZipData] = useState<Record<string, ZipData>>({});
  // --- FIX 3: Remove obsolete citiesData state ---
  // const [citiesData, setCitiesData] = useState<Record<string, CityData>>({});
  const [dataBounds, setDataBounds] = useState<{ min: number; max: number } | null>(null);
  const [fullGeoJSON, setFullGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSponsorBanner, setShowSponsorBanner] = useState(false);
  
  const { processData, isLoading, progress } = useDataWorker();

  // This effect loads ALL necessary data for the app ONCE on initial mount.
  useEffect(() => {
    const loadInitialData = async () => {
      // --- FIX 4: Update the data fetching to use the new, single data URL ---
      const result = await processData({
        type: 'LOAD_AND_PROCESS_DATA',
        data: {
          url: "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/zip-data.json.gz", // Only one URL now
          selectedMetric: 'median_sale_price',
        }
      }) as DataPayload;

      if (result) {
        setZipData(result.zipData);
        // --- FIX 5: No longer need to set citiesData ---
        // setCitiesData(result.citiesData);
        setDataBounds(result.bounds);
        const firstZip = Object.values(result.zipData)[0];
        if (firstZip?.period_end) setLastUpdated(firstZip.period_end);
      }

      // GeoJSON fetching remains the same
      const geoResponse = await fetch("https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/us-zip-codes.geojson.gz");
      const geoBuffer = await geoResponse.arrayBuffer();
      const geoDecompressed = pako.ungzip(new Uint8Array(geoBuffer), { to: 'string' });
      const geoData = JSON.parse(geoDecompressed);
      geoData.features.forEach((f: any) => { f.properties.zipCode = f.properties.ZCTA5CE20 || f.properties.GEOID20; });
      setFullGeoJSON(geoData);
    };

    loadInitialData();
    const timer = setTimeout(() => setShowSponsorBanner(true), 30000);
    return () => clearTimeout(timer);
  }, [processData]);

  // Event Handlers
  const handleZipSelect = (zip: ZipData) => { setSelectedZip(zip); setSidebarOpen(true); };
  const toggleSidebarCollapse = () => { setSidebarCollapsed(!sidebarCollapsed); };
  
  return (
    <div className="w-full h-screen bg-dashboard-bg overflow-hidden flex flex-col">
      {showSponsorBanner && <SponsorBanner onClose={() => setShowSponsorBanner(false)} />}
      
      <TopBar selectedMetric={selectedMetric} onMetricChange={setSelectedMetric} onSearch={setSearchZip} lastUpdated={lastUpdated}>
        <MapExport allZipData={zipData} fullGeoJSON={fullGeoJSON} selectedMetric={selectedMetric} />
      </TopBar>
      
      <div className="flex flex-1 relative">
        <Suspense fallback={<div>Loading...</div>}>
          {sidebarOpen && (
          <Sidebar
            isOpen={sidebarOpen}
            isCollapsed={sidebarCollapsed}
            zipData={selectedZip}
            allZipData={zipData} // <-- ADD THIS LINE
            onClose={() => setSidebarOpen(false)}
            onToggleCollapse={toggleSidebarCollapse}
          />
        )}
        </Suspense>

        <div className={`flex-1 relative transition-all duration-300 ${sidebarOpen ? (sidebarCollapsed ? "ml-16" : "ml-96") : "ml-0"}`}>
          <div className="absolute inset-0">
            <MapLibreMap
              selectedMetric={selectedMetric}
              onZipSelect={handleZipSelect}
              searchZip={searchZip}
              zipData={zipData}
              // --- FIX 6: No longer pass the obsolete citiesData prop ---
              // citiesData={citiesData}
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