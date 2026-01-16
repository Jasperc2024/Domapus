import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Checkbox } from "@/components/ui/checkbox";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LegendProps {
  selectedMetric: string;
  metricValues: number[];
  isExport?: boolean;
  autoScale?: boolean;
  onAutoScaleChange?: (value: boolean) => void;
}

// Number formatting helper
function formatLegendValue(value: number, metric: string): string {
  const m = metric.toLowerCase();
  if (m.includes("price") || m.includes("zhvi")) return `$${(value / 1000).toFixed(0)}k`;
  if (m.includes("ratio")) return `${value.toFixed(1)}%`;
  if (m.includes("mom") || m.includes("yoy")) return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}

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

export function Legend({ selectedMetric, metricValues, isExport = false, autoScale, onAutoScaleChange }: LegendProps) {
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

  // Desktop / default
  return (
    <div className="border border-border rounded-lg p-4 w-full max-w-xs bg-card/95 backdrop-blur-sm shadow-xl">
      <h3 className="text-sm font-semibold mb-3 text-foreground">
        {getMetricDisplayName(selectedMetric)}
      </h3>

      {onAutoScaleChange && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Checkbox
            id="legend-auto-scale"
            checked={autoScale}
            onCheckedChange={(c) => onAutoScaleChange(c === true)}
            className="h-3.5 w-3.5"
          />
          <label
            htmlFor="legend-auto-scale"
            className="text-[10px] font-medium leading-none cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors"
          >
            Adjust contrast to view
          </label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground/70 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="w-[180px] text-xs">
                  When enabled, the color scale automatically adjusts to the range of values currently visible on the map.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

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

    </div>
  );
}
