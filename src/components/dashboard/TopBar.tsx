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
  children?: React.ReactNode; // optional export / tools button(s)
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
      <header className="w-full bg-dashboard-panel border-b border-dashboard-border">
        <div className="max-w-full mx-auto px-4 sm:px-6">
          {/* main row */}
          <div className="flex items-center gap-6 h-16">
            {/* LEFT: brand */}
            <div
              className="flex items-center gap-3 flex-shrink-0 cursor-pointer"
              onClick={() => window.location.reload()}
              title="Reload page"
            >
              <img
                src="/Domapus/Logo.svg"
                alt="Domapus"
                className="w-10 h-10 sm:w-11 sm:h-11"
                width={40}
                height={40}
              />
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-extrabold text-dashboard-text-primary leading-tight truncate">
                  Domapus
                </div>
                <div className="text-[10px] sm:text-xs text-dashboard-text-secondary mt-0.5 hidden sm:block truncate">
                  U.S. Housing Market Analysis
                </div>
              </div>
            </div>

            {/* CENTER: controls (metric + search). prevents overlap with min-w-0 */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {/* Metric: fixed natural width, will not shrink into search */}
              <div className="flex-shrink-0">
                <MetricSelector
                  selectedMetric={selectedMetric}
                  onMetricChange={onMetricChange}
                />
              </div>

              {/* Search: fluid but constrained; min-w-0 ensures it truncates internally instead of overflowing */}
              <div className="flex-1 min-w-0">
                {/* Wrap SearchBox so we can guarantee a full-width container for it */}
                <div className="w-full max-w-full">
                  <SearchBox onSearch={onSearch} />
                </div>
              </div>
            </div>

            {/* RIGHT: last-updated, optional children (export), and links */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Last updated block */}
              <div
                className="flex items-center gap-2 text-dashboard-text-secondary whitespace-nowrap"
                aria-live="polite"
              >
                <Calendar className="h-4 w-4 opacity-85" />
                <div className="text-xs">
                  <span className="opacity-80 mr-1">Last Updated:</span>
                  <span className="font-medium">{formatDate(lastUpdated)}</span>
                </div>
              </div>

              {/* Optional tools (export etc.) */}
              {children && <div className="flex items-center">{children}</div>}

              {/* GitHub + Sponsor (no dividing line) */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 px-2.5"
                >
                  <a
                    href="https://github.com/Jasperc2024/Domapus"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open project on GitHub"
                  >
                    <Github className="h-4 w-4" />
                    <span className="hidden lg:inline ml-2 text-xs font-medium">
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
                    aria-label="Sponsor"
                  >
                    <Heart className="h-4 w-4" />
                    <span className="hidden lg:inline ml-2 text-xs font-medium">
                      Sponsor
                    </span>
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE: compact bottom panel with controls and last-updated beneath */}
      {isMobile && (
        <div className="fixed bottom-4 left-4 right-4 z-[1001] bg-dashboard-panel border border-dashboard-border rounded-lg p-3 shadow-lg">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SearchBox onSearch={onSearch} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MetricSelector
                  selectedMetric={selectedMetric}
                  onMetricChange={onMetricChange}
                />
              </div>

              <div className="text-xs text-dashboard-text-secondary">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <div className="opacity-80">Last Updated</div>
                    <div className="font-medium">{formatDate(lastUpdated)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
