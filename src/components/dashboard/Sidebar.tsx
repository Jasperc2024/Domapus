import { useState } from "react";
import { X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, BarChart3, MapPin, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ZipComparison } from "./ZipComparison";
import { ZipData } from "./map/types";

// The props now include the full dataset for the comparison feature
interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  zipData: ZipData | null;
  allZipData: Record<string, ZipData>; // The full dataset
  onClose: () => void;
  onToggleCollapse: () => void;
}

export function Sidebar({ isOpen, isCollapsed, zipData, allZipData, onClose, onToggleCollapse }: SidebarProps) {
  const [showComparison, setShowComparison] = useState(false);

  if (!isOpen || !zipData) return null;

  // Helper functions for formatting data
  const formatValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return "N/A";
    const numValue = Number(value);
    if (isNaN(numValue)) return "N/A";
    switch (type) {
      case "price": return `$${numValue.toLocaleString()}`;
      case "days": return `${numValue} days`;
      case "percentage": return `${numValue.toFixed(1)}%`;
      case "ratio": return `${(numValue * 100).toFixed(1)}%`;
      case "coordinate": return numValue.toFixed(4);
      default: return numValue.toLocaleString();
    }
  };

  const formatChange = (value: any): { formatted: string; isPositive: boolean; isZero: boolean } => {
    if (value === null || value === undefined) return { formatted: "N/A", isPositive: false, isZero: true };
    const numValue = Number(value);
    if (isNaN(numValue)) return { formatted: "N/A", isPositive: false, isZero: true };
    const isPositive = numValue > 0;
    const isZero = numValue === 0;
    return { formatted: `${isPositive ? "+" : ""}${numValue.toFixed(1)}%`, isPositive, isZero };
  };

  // The list of all metrics to display for a single ZIP code
  const allMetrics = [
    { key: "median_sale_price", label: "Median Sale Price", type: "price", momKey: "median_sale_price_mom_pct", yoyKey: "median_sale_price_yoy_pct" },
    { key: "median_list_price", label: "Median List Price", type: "price", momKey: "median_list_price_mom_pct", yoyKey: "median_list_price_yoy_pct" },
    { key: "median_dom", label: "Median Days on Market", type: "days", momKey: "median_dom_mom_pct", yoyKey: "median_dom_yoy_pct" },
    { key: "inventory", label: "Inventory", type: "number", momKey: "inventory_mom_pct", yoyKey: "inventory_yoy_pct" },
    { key: "new_listings", label: "New Listings", type: "number", momKey: "new_listings_mom_pct", yoyKey: "new_listings_yoy_pct" },
    { key: "homes_sold", label: "Homes Sold", type: "number", momKey: "homes_sold_mom_pct", yoyKey: "homes_sold_yoy_pct" },
    { key: "avg_sale_to_list_ratio", label: "Sale-to-List Ratio", type: "ratio", momKey: "avg_sale_to_list_ratio_mom_pct", yoyKey: "avg_sale_to_list_ratio_yoy_pct" },
    { key: "sold_above_list", label: "% Sold Above List", type: "percentage", momKey: "sold_above_list_mom_pct", yoyKey: "sold_above_list_yoy_pct" },
    { key: "off_market_in_two_weeks", label: "% Off Market in 2 Weeks", type: "percentage", momKey: "off_market_in_two_weeks_mom_pct", yoyKey: "off_market_in_two_weeks_yoy_pct" },
    { key: "median_ppsf", label: "Median Price per Sq Ft", type: "price", momKey: "median_ppsf_mom_pct", yoyKey: "median_ppsf_yoy_pct" },
    { key: "pending_sales", label: "Pending Sales", type: "number", momKey: "pending_sales_mom_pct", yoyKey: "pending_sales_yoy_pct" },
  ]
  .map(metric => ({ ...metric, value: zipData[metric.key as keyof ZipData] }))
  .filter(metric => metric.value !== null && metric.value !== undefined);

  return (
    <div className={`fixed left-0 top-0 h-full bg-dashboard-panel border-r border-dashboard-border shadow-lg z-40 transition-all duration-300 ${isCollapsed ? "w-16" : "w-96"}`}>
      <div className="flex items-center justify-between p-4 border-b border-dashboard-border"
           role="banner">
        {!isCollapsed && (<div><h2 className="text-lg font-semibold">{zipData.zipCode}</h2><p className="text-sm text-muted-foreground">{zipData.city}</p></div>)}
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={onToggleCollapse} aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</Button>
          {!isCollapsed && <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close sidebar"><X className="h-4 w-4" /></Button>}
        </div>
      </div>
      {!isCollapsed && (
        <div className="flex flex-col h-[calc(100vh-73px)]">
          {showComparison ? (
            <div className="p-4 flex-1 overflow-y-auto">
              <ZipComparison currentZip={zipData} allZipData={allZipData} onClose={() => setShowComparison(false)} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <Card><CardHeader><CardTitle className="text-sm flex items-center"><MapPin className="h-4 w-4 mr-2" />Location Information</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>City:</span><span className="font-medium">{zipData.city}</span></div>
                <div className="flex justify-between"><span>County:</span><span className="font-medium">{zipData.county}</span></div>
                <div className="flex justify-between"><span>Metro Area:</span><span className="font-medium">{zipData.parent_metro}</span></div>
              </CardContent></Card>
              <h3 className="text-sm font-medium pt-2 flex items-center"><Building className="h-4 w-4 mr-2" />Market Data</h3>
              <div className="space-y-3">
                {allMetrics.map((metric, index) => {
                  const momChange = metric.momKey ? formatChange(zipData[metric.momKey as keyof ZipData]) : null;
                  const yoyChange = metric.yoyKey ? formatChange(zipData[metric.yoyKey as keyof ZipData]) : null;
                  return (
                    <Card key={index}><CardContent className="p-4"><div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                      <p className="text-xl font-bold">{formatValue(metric.value, metric.type)}</p>
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
          <div className="p-4 mt-auto space-y-3 border-t border-dashboard-border bg-dashboard-panel">
            <Button variant="outline" className="w-full" onClick={() => setShowComparison(!showComparison)}><BarChart3 className="h-4 w-4 mr-2" />{showComparison ? "Back to Details" : "Compare ZIP Codes"}</Button>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Data sourced from Redfin Data Center.</p></CardContent></Card>
          </div>
        </div>
      )}
    </div>
  );
}