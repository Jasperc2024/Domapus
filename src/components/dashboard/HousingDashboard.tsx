import { useState, useEffect } from "react";
import { MetricSelector, MetricType } from "./MetricSelector";
import { SearchBox } from "./SearchBox";
import { MapView } from "./MapView";
import React, { Suspense } from "react";
const Sidebar = React.lazy(() => import("./Sidebar"));
import { Legend } from "./Legend";
import { LastUpdated } from "./LastUpdated";
import { Footer } from "./Footer";
import { TopBar } from "./TopBar";
import { SponsorBanner } from "./SponsorBanner";

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
  const [showSponsorBanner, setShowSponsorBanner] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    // Show sponsor banner after 10 seconds
    const timer = setTimeout(() => {
      setShowSponsorBanner(true);
    }, 10000);

    // Load real data and get last updated date
    fetch('/data/zip_data.json')
      .then(response => response.json())
      .then(data => {
        // Find the most recent period_end date
        const dates = Object.values(data).map((zip: any) => zip.period_end).filter(Boolean);
        if (dates.length > 0) {
          const latestDate = dates.sort().pop();
          setLastUpdated(latestDate);
        }
      })
      .catch(() => {
        // Fallback to default date if file doesn't exist yet
        setLastUpdated("2025-07-01");
      });

    return () => clearTimeout(timer);
  }, []);

  const handleZipSelect = (zipData: ZipData) => {
    setSelectedZip(zipData);
    setSidebarOpen(true);
    setSidebarCollapsed(false);
  };

  const handleSearch = (zipCode: string) => {
    setSearchZip(zipCode);
    // In a real implementation, this would zoom the map to the ZIP code
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

        {/* Map and Legend Container */}
        <div 
          className={`flex-1 relative transition-all duration-300 ${
            sidebarOpen ? (sidebarCollapsed ? 'ml-16' : 'ml-96') : 'ml-0'
          }`}
        >
          {/* Map View */}
          <div className="absolute inset-4 bottom-20">
            <MapView
              selectedMetric={selectedMetric}
              onZipSelect={handleZipSelect}
              searchZip={searchZip}
            />
          </div>

          {/* Legend - Bottom Right */}
          <div className="absolute bottom-24 right-4 w-72">
            <Legend selectedMetric={selectedMetric} />
          </div>

          {/* Status Indicators */}
          <div className="absolute top-4 right-4 flex flex-col space-y-2">
            {searchZip && (
              <div className="bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg text-sm">
                Searching for: {searchZip}
              </div>
            )}
            {selectedZip && (
              <div className="bg-accent text-accent-foreground px-3 py-2 rounded-lg shadow-lg text-sm">
                Selected: {selectedZip.zipCode}, {selectedZip.state}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Sponsor Banner */}
      {showSponsorBanner && (
        <SponsorBanner onClose={() => setShowSponsorBanner(false)} />
      )}
    </div>
  );
}
