import React, { useEffect, useState } from "react";
import { Github, Heart, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricSelector, MetricType } from "./MetricSelector";
import { SearchBox } from "./SearchBox";
import { useIsMobile } from "@/hooks/use-mobile";
const DATA_BASE = "https://jasperc2024.github.io/Domapus/";

interface TopBarProps {
  selectedMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
  onSearch: (zipCode: string) => void;
  children?: React.ReactNode; // Optional buttons like <MapExport />
}

export function TopBar({
  selectedMetric,
  onMetricChange,
  onSearch,
  children,
}: TopBarProps) {
  const isMobile = useIsMobile();
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const dataUrl = `${DATA_BASE}data/last_updated.json`;
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
    if (!dateStr) return "July 1, 2025";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "July 1, 2025";
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
              width="32"
              height="32"
              className="w-7 h-7 sm:w-8 sm:h-8"
            />
            <div className="flex flex-col font-logo">
              <h1 className="text-sm sm:text-base font-bold text-dashboard-text-primary leading-none">
                Domapus
              </h1>
              <p className="text-[9px] sm:text-[10px] text-dashboard-text-secondary leading-tight mt-0.5 hidden sm:block">
                U.S. Housing Market
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

        {/* Right Section - Actions */}
        {!isMobile && (
          <div className="flex items-center gap-4 flex-shrink-0">
            <SearchBox onSearch={onSearch} />

            {/* Last Updated */}
            <div className="flex items-center gap-1.5 text-dashboard-text-secondary">
              <Calendar className="h-3.5 w-3.5 opacity-80" />
              <span className="text-xs font-medium whitespace-nowrap">
                {formatDate(lastUpdated)}
              </span>
            </div>

            {children && <div className="flex items-center">{children}</div>}

            {/* Divider + External Links */}
            <div className="flex items-center gap-2 pl-4 border-l border-dashboard-border ml-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 px-2.5 hover:border-dashboard-text-secondary"
              >
                <a
                  href="https://github.com/Jasperc2024/Domapus"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-4 w-4 sm:mr-1" />
                  <span className="hidden lg:inline text-xs font-medium">
                    GitHub
                  </span>
                </a>
              </Button>

              <Button
                variant="default"
                size="sm"
                asChild
                className="h-8 px-2.5 bg-pink-600 hover:bg-pink-700 text-white"
              >
                <a
                  href="https://buymeacoffee.com/JasperC"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Heart className="h-4 w-4 sm:mr-1" />
                  <span className="hidden lg:inline text-xs font-medium">
                    Sponsor
                  </span>
                </a>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* === Mobile Bottom Bar === */}
      {isMobile && (
        <div className="fixed bottom-4 left-4 right-4 z-[1001] bg-dashboard-panel border border-dashboard-border rounded-lg p-3 shadow-lg">
          <div className="space-y-2.5">
            <MetricSelector
              selectedMetric={selectedMetric}
              onMetricChange={onMetricChange}
            />
            <SearchBox onSearch={onSearch} />
          </div>
        </div>
      )}
    </>
  );
}
