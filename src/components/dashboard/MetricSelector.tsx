import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type MetricType = 
  | "median_sale_price"
  | "median_list_price" 
  | "median_dom"
  | "inventory"
  | "new_listings"
  | "homes_sold"
  | "avg_sale_to_list_ratio"
  | "sold_above_list"
  | "off_market_in_two_weeks";

export const METRICS = {
  "median_sale_price": "Median Sale Price",
  "median_list_price": "Median List Price", 
  "median_dom": "Median Days on Market",
  "inventory": "Inventory",
  "new_listings": "New Listings",
  "homes_sold": "Homes Sold",
  "avg_sale_to_list_ratio": "Sale-to-List Price Ratio",
  "sold_above_list": "% Homes Sold Above List",
  "off_market_in_two_weeks": "% Off-Market in 2 Weeks"
} as const;

interface MetricSelectorProps {
  selectedMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
}

export function MetricSelector({ selectedMetric, onMetricChange }: MetricSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-dashboard-text-secondary whitespace-nowrap hidden lg:block">
        Metric:
      </label>
      <Select value={selectedMetric} onValueChange={onMetricChange}>
        <SelectTrigger className="w-48 h-8 text-sm" aria-label="Select visualization metric">
          <SelectValue placeholder="Select a metric" />
        </SelectTrigger>
        <SelectContent className="z-[9999]">
          {Object.entries(METRICS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}