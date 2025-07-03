import { useState } from "react";
import { MetricSelector, MetricType } from "./MetricSelector";
import { SearchBox } from "./SearchBox";
import { MapView } from "./MapView";
import { Sidebar } from "./Sidebar";
import { Legend } from "./Legend";
import { LastUpdated } from "./LastUpdated";

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
    <div className="w-full h-screen bg-dashboard-bg overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between p-4 bg-dashboard-panel border-b border-dashboard-border">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-dashboard-text-primary">
            U.S. Housing Market Dashboard
          </h1>
          <MetricSelector 
            selectedMetric={selectedMetric}
            onMetricChange={setSelectedMetric}
          />
        </div>
        
        <div className="flex items-center space-x-4">
          <SearchBox onSearch={handleSearch} />
          <LastUpdated />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex h-full">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          zipData={selectedZip}
          onClose={closeSidebar}
          onToggleCollapse={toggleSidebarCollapse}
        />

        {/* Map and Legend Container */}
        <div 
          className={`flex-1 relative transition-all duration-300 ${
            sidebarOpen ? (sidebarCollapsed ? 'ml-16' : 'ml-96') : 'ml-0'
          }`}
        >
          {/* Map View */}
          <div className="absolute inset-4">
            <MapView
              selectedMetric={selectedMetric}
              onZipSelect={handleZipSelect}
              searchZip={searchZip}
            />
          </div>

          {/* Legend - Bottom Right */}
          <div className="absolute bottom-4 right-4 w-72">
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
    </div>
  );
}