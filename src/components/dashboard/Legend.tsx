import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricType, METRICS } from "./MetricSelector";

interface LegendProps {
  selectedMetric: MetricType;
}

export function Legend({ selectedMetric }: LegendProps) {
  // Mock data ranges for different metrics
  const getMetricRange = (metric: MetricType) => {
    switch (metric) {
      case "median-sale-price":
        return { min: "$200K", max: "$2M+" };
      case "median-list-price":
        return { min: "$210K", max: "$2.1M+" };
      case "median-dom":
        return { min: "15 days", max: "90+ days" };
      case "inventory":
        return { min: "50", max: "500+" };
      case "new-listings":
        return { min: "10", max: "200+" };
      case "homes-sold":
        return { min: "20", max: "300+" };
      case "sale-to-list-ratio":
        return { min: "85%", max: "105%" };
      case "homes-sold-above-list":
        return { min: "0%", max: "40%" };
      case "off-market-2-weeks":
        return { min: "5%", max: "50%" };
      default:
        return { min: "Low", max: "High" };
    }
  };

  const range = getMetricRange(selectedMetric);

  return (
    <Card className="bg-dashboard-panel border-dashboard-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-dashboard-text-primary">
          {METRICS[selectedMetric]}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Color Scale */}
          <div className="relative">
            <div className="h-4 rounded-lg bg-gradient-to-r from-data-low via-data-medium-low via-data-medium via-data-medium-high to-data-high"></div>
            <div className="flex justify-between text-xs text-dashboard-text-secondary mt-1">
              <span>{range.min}</span>
              <span>{range.max}</span>
            </div>
          </div>

          {/* Legend Labels */}
          <div className="grid grid-cols-5 gap-1 text-xs">
            <div className="text-center">
              <div className="w-3 h-3 bg-data-low rounded mx-auto mb-1"></div>
              <span className="text-dashboard-text-secondary">Low</span>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-data-medium-low rounded mx-auto mb-1"></div>
              <span className="text-dashboard-text-secondary">Med-Low</span>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-data-medium rounded mx-auto mb-1"></div>
              <span className="text-dashboard-text-secondary">Medium</span>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-data-medium-high rounded mx-auto mb-1"></div>
              <span className="text-dashboard-text-secondary">Med-High</span>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-data-high rounded mx-auto mb-1"></div>
              <span className="text-dashboard-text-secondary">High</span>
            </div>
          </div>

          {/* Data Points Count */}
          <div className="text-xs text-dashboard-text-secondary text-center pt-2 border-t border-dashboard-border">
            Showing 3,247 ZIP codes
          </div>
        </div>
      </CardContent>
    </Card>
  );
}