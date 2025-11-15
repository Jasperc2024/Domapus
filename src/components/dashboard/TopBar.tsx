import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Github, Heart, Calendar, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricSelector, MetricType } from "./MetricSelector";
import { SearchBox } from "./SearchBox";
import { useIsMobile } from "@/hooks/use-mobile";

const DATA_BASE = "https://jasperc2024.github.io/Domapus/";

interface TopBarProps {
  selectedMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
  onSearch: (zipCode: string) => void;
  children?: React.ReactNode; // used for Export control — do NOT filter this out
}

/* ------------------------- MORE MENU COMPONENT ------------------------- */
const MoreMenu = ({ items }: { items: { key: string; label: string }[] }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2"
        onClick={() => setOpen((o) => !o)}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-dashboard-panel border border-dashboard-border rounded shadow-lg z-50">
          {items.map((it) => (
            <div
              key={it.key}
              className="p-2 border-b border-dashboard-border last:border-none text-sm text-dashboard-text-primary truncate"
            >
              {it.label}
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

  /***********************
   * Items & ordering
   *
   * Visual order on the right (left→right): Export, Last Updated, GitHub, Sponsor
   * Hide priority (which items to move to More menu first): Github -> Sponsor -> Export
   * Last Updated NEVER goes into the More menu (it just disappears when no space).
   ***********************/

  // Prepare the render nodes (these are the actual UI nodes used when showing visible items).
  // Ensure Export (children) is included — do NOT filter it out.
  const exportNode = (
    <div className="flex items-center">
      {/* children can be anything (export control). We don't filter it out. */}
      {children}
    </div>
  );

  const lastUpdatedNode = (
    <div
      key="lastUpdated"
      className="flex flex-col items-start text-dashboard-text-secondary whitespace-nowrap"
    >
      <div className="flex items-center gap-1">
        <Calendar className="h-4 w-4 opacity-80" />
        <span className="text-[11px] uppercase tracking-wide font-semibold">
          Data Updated
        </span>
      </div>
      <span className="text-xs font-medium mt-0.5">{formatDate(lastUpdated)}</span>
    </div>
  );

  // Buttons with consistent sizing for Export/GitHub/Sponsor:
  // We create standard className and use asChild anchor inside for links (if needed).
  const actionButtonClass = "h-8 px-2.5 min-w-[92px] flex items-center justify-center"; // fixed min width for visual consistency

  const githubNode = (
    <a
      key="github"
      href="https://github.com/Jasperc2024/Domapus"
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center ${actionButtonClass} border border-dashboard-border rounded`}
    >
      <Github className="h-4 w-4 mr-1" />
      <span className="hidden lg:inline text-xs font-medium">GitHub</span>
    </a>
  );

  const sponsorNode = (
    <a
      key="sponsor"
      href="https://buymeacoffee.com/JasperC"
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center ${actionButtonClass} bg-pink-600 hover:bg-pink-700 text-white rounded`}
    >
      <Heart className="h-4 w-4 mr-1" />
      <span className="hidden lg:inline text-xs font-medium">Sponsor</span>
    </a>
  );

  const exportButtonNode = (
    <div key="export" className={`${actionButtonClass} flex items-center justify-center`}>
      {/* show children (export control) inline to match button sizing */}
      {children ?? <div className="text-xs text-dashboard-text-secondary">Export</div>}
    </div>
  );

  // Final canonical order for rendering/measurement:
  // [export, lastUpdated, github, sponsor]
  const canonicalItems = [exportButtonNode, lastUpdatedNode, githubNode, sponsorNode];

  /******************************
   * Measurement + overflow logic
   *
   * Use a hidden offscreen measuring container to read stable widths for each item,
   * then decide which items to show. This avoids "measure-then-hide" thrashing that causes rapid switching.
   ******************************/
  const rightRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [visibleMask, setVisibleMask] = useState([true, true, true, true]); // visibility flags for canonicalItems
  const [overflowMenuItems, setOverflowMenuItems] = useState<{ key: string; label: string }[]>(
    []
  );

  const measureAndDecide = useCallback(() => {
    if (!rightRef.current || !measureRef.current) return;
    const containerWidth = rightRef.current.offsetWidth;
    const measureContainer = measureRef.current;

    // Read widths of each measured child (in the canonical order).
    const measuredEls = Array.from(measureContainer.children) as HTMLElement[];
    const widths = measuredEls.map((el) => el.offsetWidth);

    // Gaps between items: TopBar uses gap-3 → approx 0.75rem. We'll use computed style if possible, fallback to 12.
    const gap = 12;

    // width for MoreMenu button (when present). Approximate to keep layout stable.
    const moreMenuWidth = 44;

    // Start by assuming all visible
    let mask = [true, true, true, true];
    // compute total width if all shown
    const totalWidth = widths.reduce((s, w) => s + w, 0) + gap * (widths.length - 1);

    if (totalWidth <= containerWidth) {
      // everything fits — no menu
      setVisibleMask(mask);
      setOverflowMenuItems([]);
      return;
    }

    // We'll need to hide items according to hide priority until it fits.
    // Hide priority: github(index 2) -> sponsor(index 3) -> export(index 0) -> lastUpdated(index 1) (but lastUpdated should NOT go into menu)
    const hideOrder = [2, 3, 0, 1];

    // Current items widths included in total; when we hide any of github/sponsor/export we'll need to reserve space for the MoreMenu button.
    // We'll iteratively hide items until total_with_menu <= containerWidth.
    let curTotal = totalWidth;
    let menuShown = false;
    const currentMask = [true, true, true, true];

    for (const idx of hideOrder) {
      if (curTotal <= containerWidth) break;

      // If hiding this item:
      currentMask[idx] = false;
      curTotal -= widths[idx];

      // If the item we just hid is one that would appear in the menu (github/sponsor/export), ensure we add menu width (only once).
      if (!menuShown && (idx === 2 || idx === 3 || idx === 0)) {
        curTotal += moreMenuWidth;
        menuShown = true;
      }

      // Also account for gaps: when an item is hidden we reduce one gap.
      curTotal -= gap;
    }

    // Apply final mask
    setVisibleMask(currentMask);

    // Build overflow menu list according to which of [github(2), sponsor(3), export(0)] are hidden — order in menu should be github -> sponsor -> export
    const overflow: { key: string; label: string }[] = [];
    const menuPriority = [
      { idx: 2, key: "github", label: "GitHub" },
      { idx: 3, key: "sponsor", label: "Sponsor" },
      { idx: 0, key: "export", label: "Export" },
    ];

    for (const item of menuPriority) {
      if (!currentMask[item.idx]) {
        overflow.push({ key: item.key, label: item.label });
      }
    }

    // NOTE: lastUpdated (index 1) is not added to menu even if hidden.
    setOverflowMenuItems(overflow);
  }, []);

  // Measure on mount, on window resize, and when lastUpdated/children change
  useEffect(() => {
    const raf = () => {
      requestAnimationFrame(measureAndDecide);
    };
    // Initial measure on tick to let layout settle
    const timer = setTimeout(() => requestAnimationFrame(measureAndDecide), 0);

    window.addEventListener("resize", raf);
    const ro = new ResizeObserver(raf);
    if (rightRef.current) ro.observe(rightRef.current);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", raf);
      ro.disconnect();
    };
  }, [measureAndDecide, lastUpdated, children]);

  /*******************************
   * Visible items (render) and MoreMenu
   *******************************/
  // visibleItems in render order (export, lastUpdated, github, sponsor) filtered by visibleMask
  const renderedVisibleItems = canonicalItems.map((node, i) =>
    visibleMask[i] ? (
      <div key={i} className="flex-shrink-0">
        {node}
      </div>
    ) : null
  );

  return (
    <>
      <header className="w-full bg-dashboard-panel border-b border-dashboard-border">
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 sm:gap-6 h-16 flex-wrap">
            {/* LEFT: Logo + Title + MetricSelector aligned left (Metric next to logo) */}
            <div
              className="flex items-center gap-3 flex-shrink-0 cursor-pointer"
              onClick={() => window.location.reload()}
            >
              <img
                src="/Domapus/Logo.svg"
                alt="Domapus"
                className="w-10 h-10 sm:w-11 sm:h-11"
              />
              <div className="leading-tight mr-4">
                <div className="text-lg font-extrabold text-dashboard-text-primary">
                  Domapus
                </div>
                <div className="text-xs text-dashboard-text-secondary hidden sm:block">
                  U.S. Housing Market Analysis
                </div>
              </div>

              {/* MetricSelector aligned immediately to the right of the logo */}
              <div className="flex-shrink-0">
                <MetricSelector
                  selectedMetric={selectedMetric}
                  onMetricChange={onMetricChange}
                />
              </div>
            </div>

            {/* CENTER: Search stays centered. We keep SearchBox (bar+button) as a single unit. */}
            <div className="flex items-center justify-center flex-1 min-w-0 px-2">
              <div className="w-full max-w-2xl">
                <SearchBox onSearch={onSearch} />
              </div>
            </div>

            {/* RIGHT SECTION - Renders visible items */}
            <div
              ref={rightRef}
              className="flex items-center gap-3 flex-shrink-0"
              style={{ minWidth: 0 }}
            >
              {renderedVisibleItems}

              {/* Only show MoreMenu when there are overflow items */}
              <MoreMenu items={overflowMenuItems} />
            </div>
          </div>
        </div>
      </header>

      {/* Hidden measurement container — visually hidden but in DOM for stable width measurement */}
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: "absolute",
          left: -9999,
          top: -9999,
          height: 0,
          overflow: "visible",
          whiteSpace: "nowrap",
        }}
      >
        {/* Render the canonical items in order to measure their widths; ensure same classes/styles */}
        <div className="inline-flex items-center">{exportButtonNode}</div>
        <div className="inline-flex items-center ml-3">{lastUpdatedNode}</div>
        <div className="inline-flex items-center ml-3">{githubNode}</div>
        <div className="inline-flex items-center ml-3">{sponsorNode}</div>
      </div>

      {/* MOBILE CONTROLS */}
      {isMobile && (
        <div className="fixed bottom-4 left-4 right-4 z-[1001] bg-dashboard-panel border border-dashboard-border rounded-lg p-3 shadow-lg">
          <div className="flex flex-col gap-3">
            {/* left-aligned search unit (search bar + button treated as single unit) */}
            <div className="w-full">
              <SearchBox onSearch={onSearch} />
            </div>

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
