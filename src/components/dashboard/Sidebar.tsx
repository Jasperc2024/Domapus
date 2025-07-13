import {
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  BarChart3,
  MapPin,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapExport } from "../MapExport";
import { ZipComparison } from "./ZipComparison";
import { useState } from "react";

interface ZipData {
  zipCode: string;
  state: string;
  city?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  parent_metro?: string;
  // Current values
  median_sale_price?: number;
  median_list_price?: number;
  median_dom?: number;
  inventory?: number;
  new_listings?: number;
  homes_sold?: number;
  avg_sale_to_list_ratio?: number;
  sold_above_list?: number;
  off_market_in_two_weeks?: number;
  median_ppsf?: number;
  median_list_ppsf?: number;
  pending_sales?: number;
  months_of_supply?: number;
  price_drops?: number;
  // Monthly changes
  median_sale_price_mom?: number;
  median_list_price_mom?: number;
  median_dom_mom?: number;
  inventory_mom?: number;
  new_listings_mom?: number;
  homes_sold_mom?: number;
  // YoY changes
  median_sale_price_yoy?: number;
  median_list_price_yoy?: number;
  median_dom_yoy?: number;
  inventory_yoy?: number;
  new_listings_yoy?: number;
  homes_sold_yoy?: number;
  // Legacy fields for backward compatibility
  medianSalePrice?: number;
  medianListPrice?: number;
  medianDOM?: number;
  homesSold?: number;
  saleToListRatio?: number;
  homesSoldAboveList?: number;
  offMarket2Weeks?: number;
}

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  zipData: ZipData | null;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export function Sidebar({
  isOpen,
  isCollapsed,
  zipData,
  onClose,
  onToggleCollapse,
}: SidebarProps) {
  const [showComparison, setShowComparison] = useState(false);

  if (!isOpen || !zipData) return null;

  const formatValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return "N/A";

    const numValue = Number(value);
    switch (type) {
      case "price":
        return `$${numValue.toLocaleString()}`;
      case "days":
        return `${numValue} days`;
      case "percentage":
        // Display as integer if it's a whole number
        return numValue % 1 === 0
          ? `${numValue.toFixed(0)}%`
          : `${numValue.toFixed(1)}%`;
      case "ratio":
        const ratioPercent = numValue * 100;
        return ratioPercent % 1 === 0
          ? `${ratioPercent.toFixed(0)}%`
          : `${ratioPercent.toFixed(1)}%`;
      case "coordinate":
        return numValue.toFixed(4);
      default:
        return numValue % 1 === 0 ? numValue.toFixed(0) : numValue.toString();
    }
  };

  const formatChange = (
    value: any,
  ): { formatted: string; isPositive: boolean; isZero: boolean } => {
    if (value === null || value === undefined)
      return { formatted: "N/A", isPositive: false, isZero: true };
    const numValue = Number(value);
    const isPositive = numValue > 0;
    const isZero = numValue === 0;
    return {
      formatted: `${isPositive ? "+" : ""}${numValue % 1 === 0 ? numValue.toFixed(0) : numValue.toFixed(1)}%`,
      isPositive,
      isZero,
    };
  };

  // Create comprehensive metrics list with all available data
  const allMetrics = [
    {
      key: "median_sale_price",
      label: "Median Sale Price",
      type: "price",
      momKey: "median_sale_price_mom",
      yoyKey: "median_sale_price_yoy",
      value: zipData.median_sale_price || zipData.medianSalePrice,
    },
    {
      key: "median_list_price",
      label: "Median List Price",
      type: "price",
      momKey: "median_list_price_mom",
      yoyKey: "median_list_price_yoy",
      value: zipData.median_list_price || zipData.medianListPrice,
    },
    {
      key: "median_dom",
      label: "Median Days on Market",
      type: "days",
      momKey: "median_dom_mom",
      yoyKey: "median_dom_yoy",
      value: zipData.median_dom || zipData.medianDOM,
    },
    {
      key: "inventory",
      label: "Inventory",
      type: "number",
      momKey: "inventory_mom",
      yoyKey: "inventory_yoy",
      value: zipData.inventory,
    },
    {
      key: "new_listings",
      label: "New Listings",
      type: "number",
      momKey: "new_listings_mom",
      yoyKey: "new_listings_yoy",
      value: zipData.new_listings,
    },
    {
      key: "homes_sold",
      label: "Homes Sold",
      type: "number",
      momKey: "homes_sold_mom",
      yoyKey: "homes_sold_yoy",
      value: zipData.homes_sold || zipData.homesSold,
    },
    {
      key: "avg_sale_to_list_ratio",
      label: "Sale-to-List Ratio",
      type: "ratio",
      momKey: null,
      yoyKey: null,
      value: zipData.avg_sale_to_list_ratio || zipData.saleToListRatio,
    },
    {
      key: "sold_above_list",
      label: "% Sold Above List",
      type: "percentage",
      momKey: null,
      yoyKey: null,
      value: zipData.sold_above_list || zipData.homesSoldAboveList,
    },
    {
      key: "off_market_in_two_weeks",
      label: "% Off Market in 2 Weeks",
      type: "percentage",
      momKey: null,
      yoyKey: null,
      value: zipData.off_market_in_two_weeks || zipData.offMarket2Weeks,
    },
    {
      key: "median_ppsf",
      label: "Median Price per Sq Ft",
      type: "price",
      momKey: null,
      yoyKey: null,
      value: zipData.median_ppsf,
    },
    {
      key: "median_list_ppsf",
      label: "Median List Price per Sq Ft",
      type: "price",
      momKey: null,
      yoyKey: null,
      value: zipData.median_list_ppsf,
    },
    {
      key: "pending_sales",
      label: "Pending Sales",
      type: "number",
      momKey: null,
      yoyKey: null,
      value: zipData.pending_sales,
    },
    {
      key: "months_of_supply",
      label: "Months of Supply",
      type: "number",
      momKey: null,
      yoyKey: null,
      value: zipData.months_of_supply,
    },
    {
      key: "price_drops",
      label: "Price Drops",
      type: "number",
      momKey: null,
      yoyKey: null,
      value: zipData.price_drops,
    },
  ].filter(
    (metric) =>
      metric.value !== null && metric.value !== undefined && metric.value !== 0,
  );

  return (
    <div
      className={`fixed left-0 top-0 h-full bg-dashboard-panel border-r border-dashboard-border shadow-lg z-40 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-96"
      }`}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-dashboard-border">
        {!isCollapsed && (
          <div>
            <h2 className="text-lg font-semibold text-dashboard-text-primary">
              ZIP Code Details
            </h2>
            <p className="text-sm text-dashboard-text-secondary">
              {zipData.zipCode}
            </p>
            {zipData.city && (
              <p className="text-xs text-dashboard-text-secondary">
                {zipData.city}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={onToggleCollapse}>
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
          {!isCollapsed && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Sidebar Content */}
      {!isCollapsed && (
        <div className="flex flex-col h-full">
          {showComparison ? (
            <div className="p-4 flex-1 overflow-y-auto">
              <ZipComparison
                currentZip={zipData}
                onClose={() => setShowComparison(false)}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Location Badge */}
              <div className="flex items-center space-x-2 mb-4">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {zipData.zipCode}
                </Badge>
              </div>

              {/* Location Metadata */}
              <Card className="border-dashboard-border mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    Location Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {zipData.city && (
                    <div className="flex justify-between">
                      <span className="text-dashboard-text-secondary">
                        City:
                      </span>
                      <span className="font-medium">{zipData.city}</span>
                    </div>
                  )}
                  {zipData.county && (
                    <div className="flex justify-between">
                      <span className="text-dashboard-text-secondary">
                        County:
                      </span>
                      <span className="font-medium">{zipData.county}</span>
                    </div>
                  )}
                  {zipData.parent_metro && (
                    <div className="flex justify-between">
                      <span className="text-dashboard-text-secondary">
                        Metro Area:
                      </span>
                      <span className="font-medium">
                        {zipData.parent_metro}
                      </span>
                    </div>
                  )}
                  {zipData.latitude && zipData.longitude && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-dashboard-text-secondary">
                          Latitude:
                        </span>
                        <span className="font-medium">
                          {formatValue(zipData.latitude, "coordinate")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dashboard-text-secondary">
                          Longitude:
                        </span>
                        <span className="font-medium">
                          {formatValue(zipData.longitude, "coordinate")}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Market Data Header */}
              <div className="flex items-center mb-3">
                <Building className="h-4 w-4 mr-2" />
                <h3 className="text-sm font-medium text-dashboard-text-primary">
                  Market Data
                </h3>
              </div>

              {/* All Available Metrics */}
              <div className="space-y-3">
                {allMetrics.map((metric, index) => {
                  // Debug: log available data fields (remove in production)
                  if (index === 0) {
                    console.log(
                      "Available ZIP data fields:",
                      Object.keys(zipData),
                    );
                  }

                  const momChange = metric.momKey
                    ? formatChange(zipData[metric.momKey as keyof ZipData])
                    : null;
                  const yoyChange = metric.yoyKey
                    ? formatChange(zipData[metric.yoyKey as keyof ZipData])
                    : null;

                  return (
                    <Card key={index} className="border-dashboard-border">
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <p className="text-sm text-dashboard-text-secondary font-medium">
                            {metric.label}
                          </p>
                          <p className="text-xl font-bold text-dashboard-text-primary">
                            {formatValue(metric.value, metric.type)}
                          </p>

                          {/* Changes */}
                          <div className="flex flex-wrap gap-2 text-xs">
                            {momChange && !momChange.isZero && (
                              <span
                                className={`flex items-center ${
                                  momChange.isPositive
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {momChange.isPositive ? (
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                )}
                                {momChange.formatted} vs last month
                              </span>
                            )}
                            {yoyChange && !yoyChange.isZero && (
                              <span
                                className={`flex items-center ${
                                  yoyChange.isPositive
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {yoyChange.isPositive ? (
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                )}
                                {yoyChange.formatted} vs last year
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons - Fixed at bottom */}
          <div className="p-4 space-y-3 border-t border-dashboard-border bg-dashboard-panel">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowComparison(!showComparison)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {showComparison ? "Back to Details" : "Compare ZIP Codes"}
            </Button>
            <MapExport selectedMetric="current-view" />

            {/* Data Source Info */}
            <Card className="border-dashboard-border bg-muted/30">
              <CardContent className="p-3">
                <p className="text-xs text-dashboard-text-secondary">
                  Data sourced from Redfin Data Center. Updated periodically
                  from latest available data.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
