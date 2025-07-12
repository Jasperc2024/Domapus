import { Github, Heart, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricSelector, MetricType } from "./MetricSelector";
import { SearchBox } from "./SearchBox";
import { LastUpdated } from "./LastUpdated";
import { useIsMobile } from "@/hooks/use-mobile";

interface TopBarProps {
  selectedMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
  onSearch: (zipCode: string) => void;
  lastUpdated: string;
}

export function TopBar({
  selectedMetric,
  onMetricChange,
  onSearch,
  lastUpdated,
}: TopBarProps) {
  const isMobile = useIsMobile();

  return (
    <div className="flex items-center justify-between p-2 sm:p-4 bg-dashboard-panel border-b border-dashboard-border">
      <div className="flex items-center space-x-2 sm:space-x-6">
        {/* Logo and Title */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <img
            src="/Domapus/apple-touch-icon.png"
            alt="Domapus Logo"
            className="h-6 w-6 sm:h-8 sm:w-8"
            width="32"
            height="32"
            loading="eager"
            decoding="sync"
          />
          <div className="flex flex-col">
            <h1 className="text-lg sm:text-xl font-bold text-dashboard-text-primary leading-tight">
              Domapus
            </h1>
            <p className="text-xs sm:text-sm text-dashboard-text-secondary leading-tight">
              U.S. Housing Market Dashboard
            </p>
          </div>
        </div>

        {!isMobile && (
          <MetricSelector
            selectedMetric={selectedMetric}
            onMetricChange={onMetricChange}
          />
        )}
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        {!isMobile && <SearchBox onSearch={onSearch} />}
        {!isMobile && <LastUpdated lastUpdated={lastUpdated} />}

        {/* GitHub Button */}
        <Button variant="outline" size="sm" asChild className="hidden sm:flex">
          <a
            href="https://github.com/Jasperc2024/Domapus"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View project on GitHub"
            className="flex items-center space-x-2"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
            <span>GitHub</span>
          </a>
        </Button>

        {/* Sponsor Button */}
        <Button
          variant="default"
          size="sm"
          asChild
          className="hidden sm:flex bg-pink-600 hover:bg-pink-700 text-white"
        >
          <a
            href="https://buymeacoffee.com/JasperC"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support this project by sponsoring"
            className="flex items-center space-x-2"
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
            <span>Sponsor</span>
          </a>
        </Button>
      </div>

      {/* Mobile Controls */}
      {isMobile && (
        <div className="fixed bottom-4 left-4 right-4 z-[1001] bg-dashboard-panel border border-dashboard-border rounded-lg p-3 shadow-lg">
          <div className="space-y-3">
            <MetricSelector
              selectedMetric={selectedMetric}
              onMetricChange={onMetricChange}
            />
            <SearchBox onSearch={onSearch} />
          </div>
        </div>
      )}
    </div>
  );
}
