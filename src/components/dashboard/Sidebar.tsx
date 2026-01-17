import { useState, lazy, Suspense } from "react";
import { X, TrendingUp, TrendingDown, BarChart3, MapPin, Building, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ZipData } from "./map/types";
import { formatMetricValue, formatChange, METRIC_DEFINITIONS, FormatType, getStateName } from "./map/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const ZipComparison = lazy(() => import("./ZipComparison").then(m => ({ default: m.ZipComparison })));

interface SidebarProps {
  isOpen: boolean;
  zipData: ZipData | null;
  allZipData: Record<string, ZipData>;
  onClose: () => void;
}

export function Sidebar({ isOpen, zipData, allZipData, onClose }: SidebarProps) {
  const [showComparison, setShowComparison] = useState(false);
  const isMobile = useIsMobile();

  if (!isOpen || !zipData) return null;

  // Validate zipData has required fields
  if (!zipData.zipCode) {
    console.warn("[Sidebar] Invalid zipData: missing zipCode", zipData);
    return null;
  }

  // The list of all metrics to display for a single ZIP code
  const allMetrics = Object.values(METRIC_DEFINITIONS)
    .map(metric => ({
      ...metric,
      value: zipData[metric.key as keyof ZipData] as number | null
    }))
    .filter(metric => metric.value !== null && metric.value !== undefined && !isNaN(metric.value));

  return (
    <div className={`bg-dashboard-panel border-r border-dashboard-border shadow-lg flex flex-col h-full ${isMobile ? "w-full rounded-none" : "w-96 rounded-none"}`}>

      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        {showComparison ? (
          <div className="p-4 flex-1 overflow-y-auto">
            <Suspense fallback={
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }>
              <ZipComparison currentZip={zipData} allZipData={allZipData} onClose={() => setShowComparison(false)} />
            </Suspense>
          </div>
        ) : (
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            <div className="flex-none pt-1 pb-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    {zipData.zipCode || "N/A"}
                  </h2>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-1 px-1">
                {[
                  { label: "City", value: zipData.city },
                  { label: "County", value: zipData.county },
                  { label: "Metro", value: zipData.metro },
                  { label: "State", value: getStateName(zipData.state) },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-baseline">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80">
                      {item.label}
                    </span>
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      {item.value || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <h3 className="text-sm font-medium pt-1 flex items-center"><Building className="h-4 w-4 mr-2" />Market Data</h3>
            <div className="space-y-3">
              {allMetrics.map((metric, index) => {
                const momChange = metric.momKey ? formatChange(zipData[metric.momKey] as number | null) : null;
                const yoyChange = metric.yoyKey ? formatChange(zipData[metric.yoyKey] as number | null) : null;
                return (
                  <Card key={index}><CardContent className="p-4"><div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                    <p className="text-xl font-bold">{formatMetricValue(metric.value, metric.format as FormatType)}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {momChange && !momChange.isZero && (<span className={`flex items-center ${momChange.isPositive ? "text-green-600" : "text-red-600"}`}>{momChange.isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}{momChange.formatted} vs last month</span>)}
                      {yoyChange && !yoyChange.isZero && (<span className={`flex items-center ${yoyChange.isPositive ? "text-green-600" : "text-red-600"}`}>{yoyChange.isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}{yoyChange.formatted} vs last year</span>)}
                    </div>
                  </div></CardContent></Card>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex-shrink-0 px-4 py-4 border-t border-dashboard-border bg-dashboard-panel">
          <Button variant="outline" className="w-full" onClick={() => setShowComparison(!showComparison)}><BarChart3 className="h-4 w-4 mr-2" />{showComparison ? "Back to Details" : "Compare ZIP Codes"}</Button>
        </div>
      </div>
    </div>
  );
}
