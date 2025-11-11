import React, { useEffect, useState, useRef } from "react";
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
  children?: React.ReactNode;
}

/* ------------------------- MORE MENU COMPONENT ------------------------- */
const MoreMenu = ({ items }: { items: React.ReactNode[] }) => {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="relative">
      <button
        className="h-8 px-3 bg-dashboard-panel border border-dashboard-border rounded hover:bg-dashboard-border text-xs"
        onClick={() => setOpen((o) => !o)}
      >
        …
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-dashboard-panel border border-dashboard-border rounded shadow-lg z-50">
          {items.map((item, i) => (
            <div
              key={i}
              className="p-2 border-b border-dashboard-border last:border-none"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ----------------------------- MAIN TOPBAR ----------------------------- */

export function TopBar({
  selectedMetric,
  onMetricChange,
  onSearch,
  children,
}: TopBarProps) {
  const isMobile = useIsMobile();
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const fetchLastUpdated = async () => {
      try {
        const res = await fetch(`${DATA_BASE}data/last_updated.json`);
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

  /* ----------------- OVERFLOW DETECTION LOGIC ----------------- */
  const rightRef = useRef<HTMLDivElement>(null);
  const [overflowItems, setOverflowItems] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    const measure = () => {
      if (!rightRef.current) return;
      const container = rightRef.current;
      const available = container.offsetWidth;
      const nodes = Array.from(
        container.querySelectorAll(".right-item")
      ) as HTMLElement[];

      let total = 0;
      const hidden: React.ReactNode[] = [];

      nodes.forEach((node) => (node.style.display = ""));
      nodes.forEach((node) => {
        total += node.offsetWidth + 12;
        if (total > available - 50) {
          hidden.push(node.cloneNode(true) as any);
          node.style.display = "none";
        }
      });

      setOverflowItems(hidden);
    };

    measure();
    const handler = () => measure();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  /* --------------------------------------------------------------------- */

  return (
    <>
      <header className="w-full bg-dashboard-panel border-b border-dashboard-border">
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 sm:gap-6 h-16 flex-wrap">

            {/* LEFT: Logo + Title */}
            <div
              className="flex items-center gap-3 flex-shrink-0 cursor-pointer"
              onClick={() => window.location.reload()}
            >
              <img
                src="/Domapus/Logo.svg"
                alt="Domapus"
                className="w-10 h-10 sm:w-11 sm:h-11"
              />
              <div className="leading-tight">
                <div className="text-lg font-extrabold text-dashboard-text-primary">
                  Domapus
                </div>
                <div className="text-xs text-dashboard-text-secondary hidden sm:block">
                  U.S. Housing Market Analysis
                </div>
              </div>
            </div>

            {/* CENTER: Metric + Search */}
            <div className="flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
              <div className="flex-shrink-0">
                <MetricSelector
                  selectedMetric={selectedMetric}
                  onMetricChange={onMetricChange}
                />
              </div>

              <div className="flex-1 min-w-[180px] max-w-full">
                <SearchBox onSearch={onSearch} />
              </div>
            </div>

            {/* RIGHT SECTION */}
            <div
              ref={rightRef}
              className="flex items-center gap-3 flex-shrink-0 overflow-hidden"
            >
              {/* Last Updated */}
              <div className="right-item flex flex-col items-start text-dashboard-text-secondary whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 opacity-80" />
                  <span className="text-[11px] uppercase tracking-wide font-semibold">
                    Last Updated
                  </span>
                </div>
                <span className="text-xs font-medium mt-0.5">
                  {formatDate(lastUpdated)}
                </span>
              </div>

              {/* Export Button(s) */}
              {children && (
                <div className="right-item flex items-center">{children}</div>
              )}

              {/* GitHub */}
              <div className="right-item">
                <Button variant="outline" size="sm" asChild className="h-8 px-2.5">
                  <a href="https://github.com/Jasperc2024/Domapus" target="_blank">
                    <Github className="h-4 w-4 mr-1" />
                    <span className="hidden lg:inline text-xs font-medium">
                      GitHub
                    </span>
                  </a>
                </Button>
              </div>

              {/* Sponsor */}
              <div className="right-item">
                <Button
                  variant="default"
                  size="sm"
                  asChild
                  className="h-8 px-2.5 bg-pink-600 hover:bg-pink-700 text-white"
                >
                  <a href="https://buymeacoffee.com/JasperC" target="_blank">
                    <Heart className="h-4 w-4 mr-1" />
                    <span className="hidden lg:inline text-xs font-medium">
                      Sponsor
                    </span>
                  </a>
                </Button>
              </div>

              {/* MORE MENU */}
              <MoreMenu items={overflowItems} />
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE CONTROLS */}
      {isMobile && (
        <div className="fixed bottom-4 left-4 right-4 z-[1001] bg-dashboard-panel border border-dashboard-border rounded-lg p-3 shadow-lg">
          <div className="flex flex-col gap-3">
            <SearchBox onSearch={onSearch} />
            <MetricSelector
              selectedMetric={selectedMetric}
              onMetricChange={onMetricChange}
            />

            <div className="flex flex-col text-xs text-dashboard-text-secondary">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span className="uppercase font-semibold text-[11px] tracking-wide">
                  Last Updated
                </span>
              </div>
              <span className="mt-0.5">{formatDate(lastUpdated)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
