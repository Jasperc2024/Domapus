import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type MetricType = 
  | "zhvi"
  | "median_sale_price"
  | "median_ppsf"
  | "avg_sale_to_list_ratio"
  | "median_dom";

export const METRICS = {
  "zhvi": "Zillow Home Value Index",
  "median_sale_price": "Median Sale Price",
  "median_ppsf": "Median Price per Sq Ft",
  "avg_sale_to_list_ratio": "Sale-to-List Ratio",
  "median_dom": "Median Days on Market",
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