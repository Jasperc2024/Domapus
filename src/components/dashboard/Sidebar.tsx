import { X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapExport } from "../MapExport";
import { ZipComparison } from "./ZipComparison";
import { useState } from "react";

interface ZipData {
  zipCode: string;
  state: string;
  city?: string;
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
  // YoY percentage changes
  median_sale_price_yoy_pct?: number;
  median_list_price_yoy_pct?: number;
  median_dom_yoy_pct?: number;
  inventory_yoy_pct?: number;
  new_listings_yoy_pct?: number;
  homes_sold_yoy_pct?: number;
  avg_sale_to_list_yoy_pct?: number;
  sold_above_list_yoy_pct?: number;
  off_market_in_two_weeks_yoy_pct?: number;
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

export function Sidebar({ isOpen, isCollapsed, zipData, onClose, onToggleCollapse }: SidebarProps) {
  const [showComparison, setShowComparison] = useState(false);

  if (!isOpen || !zipData) return null;

  const formatValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return 'N/A';
    
    switch (type) {
      case 'price':
        return `$${Number(value).toLocaleString()}`;
      case 'days':
        return `${value} days`;
      case 'percentage':
        return `${Number(value).toFixed(1)}%`;
      case 'ratio':
        return `${(Number(value) * 100).toFixed(1)}%`;
      default:
        return value.toString();
    }
  };

  const formatYoYChange = (value: any): { formatted: string; isPositive: boolean } => {
    if (value === null || value === undefined) return { formatted: 'N/A', isPositive: false };
    const numValue = Number(value);
    const isPositive = numValue >= 0;
    return {
      formatted: `${isPositive ? '+' : ''}${numValue.toFixed(1)}%`,
      isPositive
    };
  };

  // Create comprehensive metrics list with all available data
  const allMetrics = [
    { 
      key: 'median_sale_price', 
      label: 'Median Sale Price', 
      type: 'price', 
      yoyKey: 'median_sale_price_yoy_pct',
      value: zipData.median_sale_price || zipData.medianSalePrice
    },
    { 
      key: 'median_list_price', 
      label: 'Median List Price', 
      type: 'price', 
      yoyKey: 'median_list_price_yoy_pct',
      value: zipData.median_list_price || zipData.medianListPrice
    },
    { 
      key: 'median_dom', 
      label: 'Median Days on Market', 
      type: 'days', 
      yoyKey: 'median_dom_yoy_pct',
      value: zipData.median_dom || zipData.medianDOM
    },
    { 
      key: 'inventory', 
      label: 'Inventory', 
      type: 'number', 
      yoyKey: 'inventory_yoy_pct',
      value: zipData.inventory
    },
    { 
      key: 'new_listings', 
      label: 'New Listings', 
      type: 'number', 
      yoyKey: 'new_listings_yoy_pct',
      value: zipData.new_listings
    },
    { 
      key: 'homes_sold', 
      label: 'Homes Sold', 
      type: 'number', 
      yoyKey: 'homes_sold_yoy_pct',
      value: zipData.homes_sold || zipData.homesSold
    },
    { 
      key: 'avg_sale_to_list_ratio', 
      label: 'Sale-to-List Ratio', 
      type: 'ratio', 
      yoyKey: 'avg_sale_to_list_yoy_pct',
      value: zipData.avg_sale_to_list_ratio || zipData.saleToListRatio
    },
    { 
      key: 'sold_above_list', 
      label: '% Sold Above List', 
      type: 'percentage', 
      yoyKey: 'sold_above_list_yoy_pct',
      value: zipData.sold_above_list || zipData.homesSoldAboveList
    },
    { 
      key: 'off_market_in_two_weeks', 
      label: '% Off Market in 2 Weeks', 
      type: 'percentage', 
      yoyKey: 'off_market_in_two_weeks_yoy_pct',
      value: zipData.off_market_in_two_weeks || zipData.offMarket2Weeks
    },
    { 
      key: 'median_ppsf', 
      label: 'Median Price per Sq Ft', 
      type: 'price', 
      yoyKey: null,
      value: zipData.median_ppsf
    },
    { 
      key: 'median_list_ppsf', 
      label: 'Median List Price per Sq Ft', 
      type: 'price', 
      yoyKey: null,
      value: zipData.median_list_ppsf
    },
    { 
      key: 'pending_sales', 
      label: 'Pending Sales', 
      type: 'number', 
      yoyKey: null,
      value: zipData.pending_sales
    },
    { 
      key: 'months_of_supply', 
      label: 'Months of Supply', 
      type: 'number', 
      yoyKey: null,
      value: zipData.months_of_supply
    },
    { 
      key: 'price_drops', 
      label: 'Price Drops', 
      type: 'number', 
      yoyKey: null,
      value: zipData.price_drops
    }
  ].filter(metric => metric.value !== null && metric.value !== undefined);

  return (
    <div 
      className={`fixed left-0 top-0 h-full bg-dashboard-panel border-r border-dashboard-border shadow-lg z-40 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-96'
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
              {zipData.zipCode}, {zipData.state}
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
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
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
            <div className="flex-1 overflow-y-auto">
              <Tabs defaultValue="metrics" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mx-4 mt-4">
                  <TabsTrigger value="metrics">Current Data</TabsTrigger>
                  <TabsTrigger value="trends">YoY Trends</TabsTrigger>
                </TabsList>
                
                <TabsContent value="metrics" className="p-4 space-y-3">
                  {/* Location Badge */}
                  <div className="flex items-center space-x-2 mb-4">
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {zipData.zipCode}
                    </Badge>
                    <span className="text-dashboard-text-secondary">{zipData.state}</span>
                  </div>

                  {/* All Available Metrics */}
                  <div className="space-y-3">
                    {allMetrics.map((metric, index) => (
                      <Card key={index} className="border-dashboard-border">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm text-dashboard-text-secondary font-medium">
                                {metric.label}
                              </p>
                              <p className="text-xl font-bold text-dashboard-text-primary mt-1">
                                {formatValue(metric.value, metric.type)}
                              </p>
                            </div>
                            {metric.yoyKey && zipData[metric.yoyKey as keyof ZipData] && (
                              <div className="flex flex-col items-end">
                                {(() => {
                                  const yoyChange = formatYoYChange(zipData[metric.yoyKey as keyof ZipData]);
                                  return (
                                    <>
                                      <Badge 
                                        variant={yoyChange.isPositive ? 'default' : 'destructive'}
                                        className="text-xs flex items-center space-x-1"
                                      >
                                        {yoyChange.isPositive ? 
                                          <TrendingUp className="h-3 w-3" /> : 
                                          <TrendingDown className="h-3 w-3" />
                                        }
                                        <span>{yoyChange.formatted}</span>
                                      </Badge>
                                      <span className="text-xs text-dashboard-text-secondary mt-1">vs last year</span>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="trends" className="p-4 space-y-3">
                  {/* YoY Trends */}
                  <div className="space-y-3">
                    {allMetrics.filter(m => m.yoyKey && zipData[m.yoyKey as keyof ZipData]).map((metric, index) => {
                      const yoyChange = formatYoYChange(zipData[metric.yoyKey as keyof ZipData]);
                      return (
                        <Card key={index} className="border-dashboard-border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm text-dashboard-text-secondary font-medium">
                                  {metric.label}
                                </p>
                                <p className="text-lg font-bold text-dashboard-text-primary mt-1">
                                  {formatValue(metric.value, metric.type)}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                {yoyChange.isPositive ? 
                                  <TrendingUp className="h-5 w-5 text-green-500" /> : 
                                  <TrendingDown className="h-5 w-5 text-red-500" />
                                }
                                <div className="text-right">
                                  <div className={`text-lg font-bold ${yoyChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {yoyChange.formatted}
                                  </div>
                                  <div className="text-xs text-dashboard-text-secondary">
                                    YoY Change
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
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
              {showComparison ? 'Back to Details' : 'Compare ZIP Codes'}
            </Button>
            <MapExport selectedMetric="current-view" />

            {/* Data Source Info */}
            <Card className="border-dashboard-border bg-muted/30">
              <CardContent className="p-3">
                <p className="text-xs text-dashboard-text-secondary">
                  Data sourced from Redfin Data Center. 
                  Updated periodically from latest available data.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}