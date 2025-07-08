import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type MetricType = 
  | "median-sale-price"
  | "median-list-price" 
  | "median-dom"
  | "inventory"
  | "new-listings"
  | "homes-sold"
  | "sale-to-list-ratio"
  | "homes-sold-above-list"
  | "off-market-2-weeks";

export const METRICS = {
  "median-sale-price": "Median Sale Price",
  "median-list-price": "Median List Price", 
  "median-dom": "Median Days on Market",
  "inventory": "Inventory",
  "new-listings": "New Listings",
  "homes-sold": "Homes Sold",
  "sale-to-list-ratio": "Sale-to-List Price Ratio",
  "homes-sold-above-list": "% Homes Sold Above List",
  "off-market-2-weeks": "% Off-Market in 2 Weeks"
} as const;

interface MetricSelectorProps {
  selectedMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
}

export function MetricSelector({ selectedMetric, onMetricChange }: MetricSelectorProps) {
  return (
    <div className="bg-dashboard-panel border border-dashboard-border rounded-lg p-3 shadow-sm">
      <label className="block text-sm font-medium text-dashboard-text-secondary mb-2">
        Visualization Metric
      </label>
      <Select value={selectedMetric} onValueChange={onMetricChange}>
        <SelectTrigger className="w-64" aria-label="Select visualization metric">
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