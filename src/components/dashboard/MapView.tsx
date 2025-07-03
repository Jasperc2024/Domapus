import { useState } from "react";
import { Card } from "@/components/ui/card";
import { MetricType, METRICS } from "./MetricSelector";

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

// Mock data for demonstration
const mockZipData: Record<string, ZipData> = {
  "10001": {
    zipCode: "10001",
    state: "NY",
    medianSalePrice: 850000,
    medianListPrice: 875000,
    medianDOM: 45,
    inventory: 234,
    newListings: 67,
    homesSold: 89,
    saleToListRatio: 0.97,
    homesSoldAboveList: 15,
    offMarket2Weeks: 23
  },
  "90210": {
    zipCode: "90210",
    state: "CA", 
    medianSalePrice: 1200000,
    medianListPrice: 1250000,
    medianDOM: 32,
    inventory: 156,
    newListings: 45,
    homesSold: 78,
    saleToListRatio: 0.96,
    homesSoldAboveList: 22,
    offMarket2Weeks: 31
  },
  "33101": {
    zipCode: "33101",
    state: "FL",
    medianSalePrice: 425000,
    medianListPrice: 450000,
    medianDOM: 28,
    inventory: 189,
    newListings: 89,
    homesSold: 123,
    saleToListRatio: 0.94,
    homesSoldAboveList: 8,
    offMarket2Weeks: 18
  }
};

interface MapViewProps {
  selectedMetric: MetricType;
  onZipSelect: (zipData: ZipData) => void;
  searchZip?: string;
}

export function MapView({ selectedMetric, onZipSelect, searchZip }: MapViewProps) {
  const [hoveredZip, setHoveredZip] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleZipHover = (zipCode: string, event: React.MouseEvent) => {
    setHoveredZip(zipCode);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  };

  const handleZipClick = (zipCode: string) => {
    const zipData = mockZipData[zipCode];
    if (zipData) {
      onZipSelect(zipData);
    }
  };

  const getMetricValue = (zipData: ZipData, metric: MetricType) => {
    switch (metric) {
      case "median-sale-price": return `$${zipData.medianSalePrice.toLocaleString()}`;
      case "median-list-price": return `$${zipData.medianListPrice.toLocaleString()}`;
      case "median-dom": return `${zipData.medianDOM} days`;
      case "inventory": return zipData.inventory.toString();
      case "new-listings": return zipData.newListings.toString();
      case "homes-sold": return zipData.homesSold.toString();
      case "sale-to-list-ratio": return `${(zipData.saleToListRatio * 100).toFixed(1)}%`;
      case "homes-sold-above-list": return `${zipData.homesSoldAboveList}%`;
      case "off-market-2-weeks": return `${zipData.offMarket2Weeks}%`;
      default: return "N/A";
    }
  };

  // Simulate different intensity colors for demo
  const getZipColor = (zipCode: string) => {
    const colors = ["data-low", "data-medium-low", "data-medium", "data-medium-high", "data-high"];
    const index = parseInt(zipCode.slice(-1)) % colors.length;
    return colors[index];
  };

  return (
    <div className="relative w-full h-full bg-dashboard-panel border border-dashboard-border rounded-lg overflow-hidden">
      {/* Map Container - Placeholder for actual map implementation */}
      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 relative">
        
        {/* Mock US Map Background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="text-6xl font-light text-dashboard-text-secondary">
            Interactive Map Placeholder
          </div>
        </div>

        {/* Mock ZIP Code Regions */}
        <div className="absolute top-1/4 left-1/3 w-16 h-12">
          <div 
            className={`w-full h-full bg-${getZipColor("10001")} border-2 border-map-border cursor-pointer hover:border-map-hover transition-all duration-200 rounded`}
            onMouseEnter={(e) => handleZipHover("10001", e)}
            onMouseLeave={() => setHoveredZip(null)}
            onClick={() => handleZipClick("10001")}
            onMouseMove={(e) => setTooltipPosition({ x: e.clientX, y: e.clientY })}
          />
        </div>
        
        <div className="absolute top-1/3 left-1/4 w-20 h-16">
          <div 
            className={`w-full h-full bg-${getZipColor("90210")} border-2 border-map-border cursor-pointer hover:border-map-hover transition-all duration-200 rounded`}
            onMouseEnter={(e) => handleZipHover("90210", e)}
            onMouseLeave={() => setHoveredZip(null)}
            onClick={() => handleZipClick("90210")}
            onMouseMove={(e) => setTooltipPosition({ x: e.clientX, y: e.clientY })}
          />
        </div>

        <div className="absolute bottom-1/3 right-1/3 w-18 h-14">
          <div 
            className={`w-full h-full bg-${getZipColor("33101")} border-2 border-map-border cursor-pointer hover:border-map-hover transition-all duration-200 rounded`}
            onMouseEnter={(e) => handleZipHover("33101", e)}
            onMouseLeave={() => setHoveredZip(null)}
            onClick={() => handleZipClick("33101")}
            onMouseMove={(e) => setTooltipPosition({ x: e.clientX, y: e.clientY })}
          />
        </div>

        {/* Search Result Indicator */}
        {searchZip && mockZipData[searchZip] && (
          <div className="absolute top-4 left-4 bg-accent text-accent-foreground px-3 py-2 rounded-lg shadow-lg">
            Found: {searchZip}, {mockZipData[searchZip].state}
          </div>
        )}

        {/* Map Controls */}
        <div className="absolute bottom-4 left-4 flex flex-col space-y-2">
          <button className="bg-dashboard-panel border border-dashboard-border rounded-lg p-2 shadow-sm hover:bg-secondary transition-colors">
            <span className="text-lg font-mono">+</span>
          </button>
          <button className="bg-dashboard-panel border border-dashboard-border rounded-lg p-2 shadow-sm hover:bg-secondary transition-colors">
            <span className="text-lg font-mono">−</span>
          </button>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredZip && mockZipData[hoveredZip] && (
        <div 
          className="fixed z-50 bg-dashboard-panel border border-dashboard-border rounded-lg p-3 shadow-lg pointer-events-none"
          style={{ 
            left: tooltipPosition.x + 10, 
            top: tooltipPosition.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="font-semibold text-dashboard-text-primary">
            {hoveredZip}, {mockZipData[hoveredZip].state}
          </div>
          <div className="text-sm text-dashboard-text-secondary">
            {METRICS[selectedMetric]}: {getMetricValue(mockZipData[hoveredZip], selectedMetric)}
          </div>
        </div>
      )}
    </div>
  );
}