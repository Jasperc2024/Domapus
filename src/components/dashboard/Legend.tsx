import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface LegendProps {
  selectedMetric: string;
  metricValues: number[];
  isExport?: boolean; // Optional prop to remove interactive hints for PDF
}

// Number formatting helper
function formatLegendValue(value: number, metric: string): string {
  const m = metric.toLowerCase();
  if (m.includes("price") || m.includes("zhvi")) return `$${(value / 1000).toFixed(0)}k`;
  if (m.includes("ratio")) return `${value.toFixed(1)}%`;
  if (m.includes("mom") || m.includes("yoy")) return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}

// Compute arbitrary percentiles
function computeQuantiles(values: number[], percentiles: number[]) {
  if (!values || values.length === 0) return percentiles.map(() => 0);
  const sorted = [...values].sort((a, b) => a - b);
  return percentiles.map((p) => {
    const idx = (sorted.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  });
}

export function Legend({ selectedMetric, metricValues, isExport = false }: LegendProps) {
  const isMobile = useIsMobile();

  const legendDisplay = useMemo(() => {
    if (!metricValues || metricValues.length === 0) {
      return { min: "N/A", mid: "N/A", max: "N/A" };
    }

    // 5th, 50th, 95th percentiles for robust min/mid/max
    const [min, mid, max] = computeQuantiles(metricValues, [0.05, 0.5, 0.95]);

    return {
      min: formatLegendValue(min, selectedMetric),
      mid: formatLegendValue(mid, selectedMetric),
      max: formatLegendValue(max, selectedMetric),
    };
  }, [metricValues, selectedMetric]);

  const getMetricDisplayName = (metric: string): string => {
    const metricNames: Record<string, string> = {
      zhvi: "Zillow Home Value Index",
      median_sale_price: "Median Sale Price",
      median_ppsf: "Median Price per Sq Ft",
      sale_to_list_ratio: "Sale-to-List Ratio",
      avg_sale_to_list_ratio: "Sale-to-List Ratio",
      median_dom: "Median Days on Market",
    };
    return (
      metricNames[metric] ||
      metric
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    );
  };

  const gradient =
    "linear-gradient(to right, hsl(var(--choropleth-1)), hsl(var(--choropleth-2)), hsl(var(--choropleth-3)), hsl(var(--choropleth-4)), hsl(var(--choropleth-5)), hsl(var(--choropleth-6)), hsl(var(--choropleth-7)), hsl(var(--choropleth-8)))";

  const verticalGradient =
    "linear-gradient(to top, hsl(var(--choropleth-1)), hsl(var(--choropleth-3)), hsl(var(--choropleth-5)), hsl(var(--choropleth-8)))";

  // Mobile: compact vertical bar with 3 values (non-export)
  if (isMobile && !isExport) {
    return (
      <div className="bg-card/95 backdrop-blur-sm shadow-lg border border-border rounded-md p-3 w-36">
        <div className="text-xs font-semibold text-foreground truncate mb-2">
          {getMetricDisplayName(selectedMetric)}
        </div>
        <div className="flex items-stretch gap-2">
          <div
            className="w-3 rounded-sm border border-border"
            style={{ background: verticalGradient }}
            aria-hidden="true"
          />
          <div className="flex flex-col justify-between text-[11px] font-medium text-muted-foreground">
            <span className="text-foreground">{legendDisplay.max}</span>
            <span>{legendDisplay.mid}</span>
            <span>{legendDisplay.min}</span>
          </div>
        </div>
      </div>
    );
  }

  // Export: elements only (no card/border)
  if (isExport) {
    return (
      <div className="bg-transparent p-0">
        <div className="text-xs font-semibold text-foreground mb-2">
          {getMetricDisplayName(selectedMetric)}
        </div>
        <div
          className="h-3 rounded-sm border border-border"
          style={{ background: gradient }}
          aria-hidden="true"
        />
        <div className="mt-1 flex justify-between text-[11px] font-medium text-muted-foreground">
          <span>{legendDisplay.min}</span>
          <span>{legendDisplay.mid}</span>
          <span>{legendDisplay.max}</span>
        </div>
      </div>
    );
  }

  // Desktop / default
  return (
    <div className="border border-border rounded-lg p-4 w-full max-w-xs bg-card/95 backdrop-blur-sm shadow-xl">
      <h3 className="text-sm font-semibold mb-3 text-foreground">
        {getMetricDisplayName(selectedMetric)}
      </h3>

      <div className="space-y-2">
        <div
          className="h-4 rounded-md border border-border"
          style={{ background: gradient }}
          aria-hidden="true"
        />

        <div className="flex justify-between text-xs text-muted-foreground font-semibold">
          <span>{legendDisplay.min}</span>
          <span>{legendDisplay.mid}</span>
          <span>{legendDisplay.max}</span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-border/60">
        <p className="text-[10px] text-muted-foreground text-center">
          Click ZIP code to view more info
        </p>
      </div>
    </div>
  );
}
