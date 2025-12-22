import React, { useEffect, useState } from "react";
import { Github, Heart, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricSelector, MetricType } from "./MetricSelector";
import { SearchBox } from "./SearchBox";
import { useIsMobile } from "@/hooks/use-mobile";
const BASE_PATH = import.meta.env.BASE_URL;

interface TopBarProps {
  selectedMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
  onSearch: (zipCode: string, trigger: number) => void;
  hideMobileControls?: boolean;
  children?: React.ReactNode; // Optional buttons like <MapExport />
}

export function TopBar({
  selectedMetric,
  onMetricChange,
  onSearch,
  hideMobileControls = false,
  children,
}: TopBarProps) {
  const isMobile = useIsMobile();
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const dataUrl = `${BASE_PATH}data/last_updated.json`;
    const fetchLastUpdated = async () => {
      try {
        const res = await fetch(dataUrl);
        if (!res.ok) throw new Error("Failed to fetch last_updated.json");
        const data = await res.json();
        setLastUpdated(data.last_updated_utc);
      } catch (err) {
        console.error("Error fetching last_updated.json:", err);
      }
    };
    fetchLastUpdated();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  return (
    <>
      {/* === Desktop / Main Header === */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-2 bg-dashboard-panel border-b border-dashboard-border h-14 sm:h-16">
        {/* Left Section - Logo + Metric Selector */}
        <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
            onClick={() => window.location.reload()}
            title="Click to reload page"
          >
            <img
              src="/Domapus/Logo.svg"
              alt="Domapus Logo"
              width="40"
              height="40"
              className="w-9 h-9 sm:w-10 sm:h-10"
            />
            <div className="flex flex-col font-logo">
              <h1 className="text-base sm:text-lg font-bold text-dashboard-text-primary leading-tight">
                Domapus
              </h1>
              <p className="text-xs sm:text-sm text-dashboard-text-secondary leading-tight hidden sm:block">
                Housing Market Analysis
              </p>
            </div>
          </div>

          {/* We hide the desktop MetricSelector only when on mobile */}
          {!isMobile && (
            <MetricSelector
              selectedMetric={selectedMetric}
              onMetricChange={onMetricChange}
            />
          )}
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-4 flex-shrink-0">
            {!isMobile && <SearchBox onSearch={onSearch} />}
            <div className="flex items-center gap-2 ml-1">
            
            {/* Last Updated */}
            <div className="flex items-center text-dashboard-text-secondary gap-2 mr-2">
              <Calendar className="h-4 w-4 opacity-80" />
              <div className="flex flex-col">
                <span className="text-xs font-medium">Data Updated:</span>
                <span className="text-xs font-medium whitespace-nowrap">
                  {formatDate(lastUpdated)}
                </span>
              </div>
            </div>
              {/* Export */}
              {children}
              
              {/* GitHub button */}
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href="https://github.com/Jasperc2024/Domapus"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="GitHub"
                >
                  <Github className="h-4 w-4 mr-2" />
                  {!isMobile && <span>GitHub</span>} {/* Hide this span on mobile */}
                </a>
              </Button>

              {/* Sponsor button */}
              <Button
                variant="outline"
                size="sm"
                asChild
                className="bg-pink-600 hover:bg-pink-700 text-white"
              >
                <a
                  href="https://buymeacoffee.com/JasperC"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Sponsor"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  {!isMobile && <span>Sponsor</span>} {/* Hide this span on mobile */}
                </a>
              </Button>
            </div>
          </div>
      </header>

      {/* === Mobile Bottom Bar === */}
      {isMobile && (
        <div className="fixed bottom-4 left-4 right-4 z-[1001] bg-dashboard-panel border border-dashboard-border rounded-lg p-3 shadow-lg">
          <div className="space-y-2.5">
            {!hideMobileControls && (
              <MetricSelector
                selectedMetric={selectedMetric}
                onMetricChange={onMetricChange}
              />
            )}
            <SearchBox onSearch={onSearch} />
          </div>
        </div>
      )}
    </>
  );
}
