import { useState, lazy, Suspense } from "react";
import { X, TrendingUp, TrendingDown, BarChart3, MapPin, Building, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ZipData } from "./map/types";
import { formatMetricValue, formatChange, METRIC_DEFINITIONS, FormatType } from "./map/utils";
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
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-dashboard-border"
        role="banner"
      >
        <div className="flex flex-col justify-center">
          <h2 className="text-lg font-semibold leading-tight">{zipData.zipCode || "Unknown ZIP"}</h2>
          <p className="text-sm text-muted-foreground leading-none">{zipData.city || zipData.state || "Location unknown"}</p>
        </div>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <Card className="bg-card border shadow-none">
              <CardContent className="p-3 space-y-1 text-xs">
                <div className="flex justify-between items-center text-muted-foreground mb-1">
                  <span className="flex items-center font-medium uppercase tracking-wider text-[10px]">
                    <MapPin className="h-3 w-3 mr-1" /> Location
                  </span>
                </div>
                <div className="flex justify-between"><span>City:</span><span className="font-medium text-foreground">{zipData.city || "N/A"}</span></div>
                <div className="flex justify-between"><span>County:</span><span className="font-medium text-foreground">{zipData.county || "N/A"}</span></div>
                <div className="flex justify-between"><span>State:</span><span className="font-medium text-foreground">{zipData.state || "N/A"}</span></div>
                <div className="flex justify-between"><span>Metro Area:</span><span className="font-medium text-foreground">{zipData.metro || "N/A"}</span></div>
              </CardContent>
            </Card>
            <h3 className="text-sm font-medium pt-2 flex items-center"><Building className="h-4 w-4 mr-2" />Market Data</h3>
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
