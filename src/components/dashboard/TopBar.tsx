import { Github, Heart } from "lucide-react"; // Keeping 'Github' as you requested
import { Button } from "@/components/ui/button";
import { MetricSelector, MetricType } from "./MetricSelector";
import { SearchBox } from "./SearchBox";
import { LastUpdated } from "./LastUpdated";
import { useIsMobile } from "@/hooks/use-mobile";
import React from "react";

interface TopBarProps {
  selectedMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
  onSearch: (zipCode: string) => void;
  lastUpdated: string;
  children?: React.ReactNode; // For passing in the <MapExport /> button
}

export function TopBar({
  selectedMetric,
  onMetricChange,
  onSearch,
  lastUpdated,
  children,
}: TopBarProps) {
  const isMobile = useIsMobile();

  return (
    <div className="flex items-center justify-between p-2 sm:p-4 bg-dashboard-panel border-b border-dashboard-border">
      <div className="flex items-center space-x-2 sm:space-x-6">
        <div
          className="flex items-center space-x-2 sm:space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => window.location.reload()}
          title="Click to reload page"
        >
          <img src="/Domapus/Logo.svg" alt="Domapus Logo" className="h-8 w-8 sm:h-10 sm:w-10" />
          
          {/* This div applies the special 'Inter' font only to the logo and subtitle */}
          <div className="flex flex-col font-logo">
            <h1 className="text-lg sm:text-xl font-bold text-dashboard-text-primary leading-tight">
              Domapus
            </h1>
            <p className="text-xs sm:text-sm text-dashboard-text-secondary leading-tight">
              U.S. Housing Market Dashboard
            </p>
          </div>
        </div>

        {!isMobile && <MetricSelector selectedMetric={selectedMetric} onMetricChange={onMetricChange} />}
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        {!isMobile && <SearchBox onSearch={onSearch} />}
        {!isMobile && <LastUpdated lastUpdated={lastUpdated} />}
        
        {/* This renders the <MapExport /> button on desktop views */}
        {!isMobile && children} 

        <Button variant="outline" size="sm" asChild className="hidden sm:flex">
          <a href="https://github.com/Jasperc2024/Domapus" target="_blank" rel="noopener noreferrer">
            <Github className="h-4 w-4 mr-2" />
            <span>GitHub</span>
          </a>
        </Button>

        <Button variant="default" size="sm" asChild className="hidden sm:flex bg-pink-600 hover:bg-pink-700 text-white">
          <a href="https://buymeacoffee.com/JasperC" target="_blank" rel="noopener noreferrer">
            <Heart className="h-4 w-4 mr-2" />
            <span>Sponsor</span>
          </a>
        </Button>
      </div>

      {/* Mobile view correctly does not include the Export, GitHub, or Sponsor buttons */}
      {isMobile && (
        <div className="fixed bottom-4 left-4 right-4 z-[1001] bg-dashboard-panel border border-dashboard-border rounded-lg p-3 shadow-lg">
          <div className="space-y-3">
            <MetricSelector selectedMetric={selectedMetric} onMetricChange={onMetricChange} />
            <SearchBox onSearch={onSearch} />
          </div>
        </div>
      )}
    </div>
  );
}