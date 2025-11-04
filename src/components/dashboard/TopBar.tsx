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
    <>
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 bg-dashboard-panel border-b border-dashboard-border h-16 sm:h-[72px]">
        {/* Left Section - Logo and Metric Selector */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-shrink-0">
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
            onClick={() => window.location.reload()}
            title="Click to reload page"
          >
            <img 
              src="/Domapus/Logo.svg" 
              alt="Domapus Logo" 
              width="32" 
              height="32"
              className="w-8 h-8 sm:w-9 sm:h-9" 
            />
            <div className="flex flex-col font-logo min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-dashboard-text-primary leading-none">
                Domapus
              </h1>
              <p className="text-[10px] sm:text-xs text-dashboard-text-secondary leading-tight mt-0.5 hidden sm:block">
                U.S. Housing Market
              </p>
            </div>
          </div>

          {!isMobile && (
            <div className="flex-shrink-0">
              <MetricSelector selectedMetric={selectedMetric} onMetricChange={onMetricChange} />
            </div>
          )}
        </div>

        {/* Right Section - Actions */}
        {!isMobile && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <SearchBox onSearch={onSearch} />
            <LastUpdated lastUpdated={lastUpdated} />
            {children}
            
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-dashboard-border">
              <Button variant="outline" size="sm" asChild className="h-8">
                <a href="https://github.com/Jasperc2024/Domapus" target="_blank" rel="noopener noreferrer">
                  <Github className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden lg:inline">GitHub</span>
                </a>
              </Button>

              <Button variant="default" size="sm" asChild className="h-8 bg-pink-600 hover:bg-pink-700 text-white">
                <a href="https://buymeacoffee.com/JasperC" target="_blank" rel="noopener noreferrer">
                  <Heart className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden lg:inline">Sponsor</span>
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Bar */}
      {isMobile && (
        <div className="fixed bottom-4 left-4 right-4 z-[1001] bg-dashboard-panel border border-dashboard-border rounded-lg p-3 shadow-lg">
          <div className="space-y-2.5">
            <MetricSelector selectedMetric={selectedMetric} onMetricChange={onMetricChange} />
            <SearchBox onSearch={onSearch} />
          </div>
        </div>
      )}
    </>
  );
}