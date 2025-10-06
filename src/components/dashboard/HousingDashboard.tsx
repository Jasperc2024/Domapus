import { useState, useEffect } from "react";
import { useDataWorker } from "@/hooks/useDataWorker";
import { ZipData } from "./map/types";
import { MapExport } from "@/components/MapExport";

import { TopBar } from "./TopBar";
import { MapLibreMap } from "./MapLibreMap";
import { Legend } from "./Legend";
import { SponsorBanner } from "./SponsorBanner";
import { Sidebar } from "./Sidebar";

export type MetricType = "median_sale_price" | "median_list_price" | "median_dom" | "inventory" | "new_listings" | "homes_sold" | "avg_sale_to_list_ratio" | "sold_above_list" | "off_market_in_two_weeks";
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
  const [fullGeoJSON, setFullGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSponsorBanner, setShowSponsorBanner] = useState(false);
  
  const { processData, isLoading, progress } = useDataWorker();

  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      const dataUrl = new URL(`${BASE_PATH}data/zip-data.json.gz`, window.location.origin).href;
      const geoJsonUrl = new URL(`${BASE_PATH}data/us-zip-codes.geojson.gz`, window.location.origin).href;

      try {
        const result = await processData({
          type: 'LOAD_AND_PROCESS_DATA',
          data: { url: dataUrl, selectedMetric: 'median_sale_price' }
        }) as DataPayload;

        if (!isMounted) return;
        
        if (result) {
          setZipData(result.zip_codes);
          setDataBounds(result.bounds);
          setLastUpdated(result.last_updated_utc);
        }

        const geoResponse = await fetch(geoJsonUrl);
        if (!geoResponse.ok) throw new Error(`Failed to fetch GeoJSON: ${geoResponse.status}`);

        if (!isMounted) return;

        const contentEncoding = geoResponse.headers.get("content-encoding") || "";
        const isGzipped = contentEncoding.includes("gzip") || geoJsonUrl.endsWith(".gz");
        const buffer = await geoResponse.arrayBuffer();

        let geoData;
        
        if (isGzipped) {
          try {
            geoData = JSON.parse(new TextDecoder().decode(buffer));
          } catch {
            const { inflate } = await import("pako");
            const jsonString = inflate(new Uint8Array(buffer), { to: "string" });
            geoData = JSON.parse(jsonString);
          }
        } else {
          try {
            const { inflate } = await import("pako");
            const jsonString = inflate(new Uint8Array(buffer), { to: "string" });
            geoData = JSON.parse(jsonString);
          } catch {
            geoData = JSON.parse(new TextDecoder().decode(buffer));
          }
        }
        
        if (!isMounted) return;
        setFullGeoJSON(geoData);
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
  }, []);
  
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
