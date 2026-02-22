import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export type MetricType =
  | "zhvi"
  | "median_sale_price"
  | "median_ppsf"
  | "avg_sale_to_list_ratio"
  | "median_dom"
  | "median_list_price"
  | "homes_sold"
  | "pending_sales"
  | "new_listings"
  | "inventory"
  | "sold_above_list"
  | "off_market_in_two_weeks";

export const METRICS = {
  "zhvi": "Zillow Home Value Index",
  "median_sale_price": "Median Sale Price",
  "median_list_price": "Median List Price",
  "median_ppsf": "Median Price per Sq Ft",
  "homes_sold": "Homes Sold",
  "pending_sales": "Pending Sales",
  "new_listings": "New Listings",
  "inventory": "Inventory",
  "avg_sale_to_list_ratio": "Sale-to-List Ratio",
  "median_dom": "Median Days on Market",
  "sold_above_list": "% Sold Above List",
  "off_market_in_two_weeks": "% Off Market in 2 Weeks",
} as const;

// Fields available in the lite data file (loaded first for fast initial render)
const LITE_METRICS = new Set<string>(["zhvi"]);

interface MetricSelectorProps {
  selectedMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
  isFullDataLoaded?: boolean;
}

export function MetricSelector({ selectedMetric, onMetricChange, isFullDataLoaded = false }: MetricSelectorProps) {
  const handleMetricChange = (metric: string) => {
    onMetricChange(metric as MetricType);
  };

  return (
    <div className="flex items-center gap-1">
      <label className="text-xs font-medium text-dashboard-text-secondary whitespace-nowrap hidden lg:block">
        Metric:
      </label>
      <Select value={selectedMetric} onValueChange={handleMetricChange}>
        <SelectTrigger className="w-50 h-8 text-sm px-3 justify-between" aria-label="Select visualization metric">
          <div className="flex-1 text-left truncate pr-2">
            <SelectValue placeholder="Select a metric" />
          </div>
        </SelectTrigger>
        <SelectContent className="z-[9999]">
          {Object.entries(METRICS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              <span className="flex items-center gap-1.5">
                {label}
                {!isFullDataLoaded && !LITE_METRICS.has(key) && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}