
import { useState, useEffect } from "react";
import { MetricSelector, MetricType } from "./MetricSelector";
import { SearchBox } from "./SearchBox";
import { LeafletMap } from "./LeafletMap";
import React, { Suspense } from "react";
const Sidebar = React.lazy(() =>
  import("./Sidebar").then((module) => ({ default: module.Sidebar }))
);
import { Legend } from "./Legend";
import { LastUpdated } from "./LastUpdated";
import pako from 'pako';
import { TopBar } from "./TopBar";

interface ZipData {
  zipCode: string;
  state: string;
  medianSalePrice: number;
  medianListPrice: number;
  medianDOM: number;
  inventory: number;
  newListings: number;
  homesSold: number;
  saleToListRatio: number;
  homesSoldAboveList: number;
  offMarket2Weeks: number;
}

export function HousingDashboard() {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("median-sale-price");
  const [selectedZip, setSelectedZip] = useState<ZipData | null>(null);
  const [searchZip, setSearchZip] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
  const loadLastUpdatedDate = async () => {
    try {
      const response = await fetch(import.meta.env.BASE_URL + 'data/zip-data.json.gz');
      const arrayBuffer = await response.arrayBuffer();
      const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), { to: 'string' });
      const data = JSON.parse(decompressed);

      const dates = Object.values(data)
        .map((zip: any) => zip.period_end)
        .filter(Boolean);

      if (dates.length > 0) {
        const latestDate = dates.sort().pop();
        setLastUpdated(latestDate);
      } else {
        setLastUpdated("2025-07-01");
      }
    } catch (error) {
      console.error("Failed to load or decompress zip-data.json.gz", error);
      setLastUpdated("2025-07-01");
    }
  };

  loadLastUpdatedDate();
}, []);

  const handleZipSelect = (zipData: ZipData) => {
    setSelectedZip(zipData);
    setSidebarOpen(true);
    setSidebarCollapsed(false);
  };

  const handleSearch = (zipCode: string) => {
    setSearchZip(zipCode);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setSelectedZip(null);
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="w-full h-screen bg-dashboard-bg overflow-hidden flex flex-col">
      {/* Top Navigation Bar */}
      <TopBar 
        selectedMetric={selectedMetric}
        onMetricChange={setSelectedMetric}
        onSearch={handleSearch}
        lastUpdated={lastUpdated}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 relative">
        {/* Sidebar */}
        <Suspense fallback={<div className="p-4 text-sm text-muted">Loading sidebar...</div>}>
          <Sidebar
            isOpen={sidebarOpen}
            isCollapsed={sidebarCollapsed}
            zipData={selectedZip}
            onClose={closeSidebar}
            onToggleCollapse={toggleSidebarCollapse}
          />
        </Suspense>

        {/* Map Container - Full size with proper positioning */}
        <div 
          className={`flex-1 relative transition-all duration-300 ${
            sidebarOpen ? (sidebarCollapsed ? 'ml-16' : 'ml-96') : 'ml-0'
          }`}
        >
          {/* Map View - Full container */}
          <div className="absolute inset-0">
            <LeafletMap
              selectedMetric={selectedMetric}
              onZipSelect={handleZipSelect}
              searchZip={searchZip}
            />
          </div>

          {/* Legend - Bottom Right with proper z-index */}
          <div className="absolute bottom-4 right-4 w-72 z-[1000] pointer-events-auto">
            <Legend selectedMetric={selectedMetric} />
          </div>

          {/* Status Indicators - Top Right with proper z-index */}
          <div className="absolute top-4 right-4 flex flex-col space-y-2 z-[1000] pointer-events-auto">
            {searchZip && (
              <div className="bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg text-sm">
                Searching for: {searchZip}
              </div>
            )}
            {selectedZip && (
              <div className="bg-accent text-accent-foreground px-3 py-2 rounded-lg shadow-lg text-sm">
                Selected: {selectedZip.zipCode}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
