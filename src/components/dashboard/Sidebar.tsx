import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ZipData {
  zipCode: string;
  state: string;
  medianSalePrice: number;
  medianListPrice: number;
  medianDOM: number;
  inventory: number;
  newListings: number;
  homesSold: number;
  saleToListRatio: number;
  homesSoldAboveList: number;
  offMarket2Weeks: number;
}

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  zipData: ZipData | null;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export function Sidebar({ isOpen, isCollapsed, zipData, onClose, onToggleCollapse }: SidebarProps) {
  if (!isOpen || !zipData) return null;

  const metrics = [
    { label: "Median Sale Price", value: `$${zipData.medianSalePrice.toLocaleString()}`, change: "+5.2%" },
    { label: "Median List Price", value: `$${zipData.medianListPrice.toLocaleString()}`, change: "+3.8%" },
    { label: "Median Days on Market", value: `${zipData.medianDOM} days`, change: "-12%" },
    { label: "Inventory", value: zipData.inventory.toString(), change: "+8.1%" },
    { label: "New Listings", value: zipData.newListings.toString(), change: "+15.3%" },
    { label: "Homes Sold", value: zipData.homesSold.toString(), change: "+2.7%" },
    { label: "Sale-to-List Price Ratio", value: `${(zipData.saleToListRatio * 100).toFixed(1)}%`, change: "-1.2%" },
    { label: "% Homes Sold Above List", value: `${zipData.homesSoldAboveList}%`, change: "+4.5%" },
    { label: "% Off-Market in 2 Weeks", value: `${zipData.offMarket2Weeks}%`, change: "+6.8%" }
  ];

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
        <div className="p-4 space-y-4 overflow-y-auto h-full pb-20">
          {/* Location Badge */}
          <div className="flex items-center space-x-2 mb-4">
            <Badge variant="outline" className="text-lg px-3 py-1">
              {zipData.zipCode}
            </Badge>
            <span className="text-dashboard-text-secondary">{zipData.state}</span>
          </div>

          {/* Metrics Grid */}
          <div className="space-y-3">
            {metrics.map((metric, index) => (
              <Card key={index} className="border-dashboard-border">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm text-dashboard-text-secondary font-medium">
                        {metric.label}
                      </p>
                      <p className="text-xl font-bold text-dashboard-text-primary mt-1">
                        {metric.value}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <Badge 
                        variant={metric.change.startsWith('+') ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {metric.change}
                      </Badge>
                      <span className="text-xs text-dashboard-text-secondary mt-1">vs last month</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4 border-t border-dashboard-border">
            <Button variant="outline" className="w-full" disabled>
              Compare to Neighboring ZIPs
            </Button>
            <Button variant="outline" className="w-full" disabled>
              View Historical Trends
            </Button>
            <Button variant="outline" className="w-full" disabled>
              Export Data
            </Button>
          </div>

          {/* Data Source Info */}
          <Card className="border-dashboard-border bg-muted/30">
            <CardContent className="p-3">
              <p className="text-xs text-dashboard-text-secondary">
                Data sourced from multiple MLS systems and public records. 
                Last updated: June 28, 2024
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}