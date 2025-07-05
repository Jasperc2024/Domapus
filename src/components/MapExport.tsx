import { useState } from "react";
import { Download, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MapExportProps {
  selectedMetric: string;
}

export function MapExport({ selectedMetric }: MapExportProps) {
  const [exportType, setExportType] = useState<"national" | "state">("national");
  const [selectedState, setSelectedState] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  const states = [
    { code: "CA", name: "California" },
    { code: "NY", name: "New York" },
    { code: "TX", name: "Texas" },
    { code: "FL", name: "Florida" },
    { code: "IL", name: "Illinois" },
    { code: "WA", name: "Washington" },
    // Add more states as needed
  ];

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // Create canvas for map export
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Cannot get canvas context');

      // Background
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Title
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      const title = exportType === 'national' 
        ? `U.S. Housing Market - ${selectedMetric}` 
        : `${selectedState} Housing Market - ${selectedMetric}`;
      ctx.fillText(title, canvas.width / 2, 40);
      
      // Map placeholder (in real implementation, render actual map)
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(50, 70, canvas.width - 300, canvas.height - 200);
      
      ctx.fillStyle = '#64748b';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Map Visualization', canvas.width / 2 - 75, canvas.height / 2);
      
      // Legend area
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(canvas.width - 240, 70, 190, 300);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(canvas.width - 240, 70, 190, 300);
      
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Legend', canvas.width - 230, 95);
      
      // Sample legend items
      const legendItems = ['Low', 'Medium-Low', 'Medium', 'Medium-High', 'High'];
      const legendColors = ['#dcfce7', '#bbf7d0', '#fef3c7', '#fed7aa', '#fecaca'];
      
      legendItems.forEach((item, index) => {
        const y = 120 + (index * 25);
        ctx.fillStyle = legendColors[index];
        ctx.fillRect(canvas.width - 230, y - 10, 15, 15);
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(canvas.width - 230, y - 10, 15, 15);
        
        ctx.fillStyle = '#1e293b';
        ctx.font = '12px Arial';
        ctx.fillText(item, canvas.width - 210, y + 2);
      });
      
      // Watermark area
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(50, canvas.height - 120, canvas.width - 100, 70);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(50, canvas.height - 120, canvas.width - 100, 70);
      
      // Favicon placeholder (in real implementation, load actual favicon)
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(70, canvas.height - 100, 30, 30);
      
      // Website info
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Generated from: domapus.com', 110, canvas.height - 85);
      ctx.fillText(`Export Date: ${new Date().toLocaleDateString()}`, 110, canvas.height - 70);
      
      // Data source
      ctx.font = '10px Arial';
      ctx.fillText('Data Source: Redfin Market Data', 110, canvas.height - 55);
      
      // Download the canvas as PNG
      const link = document.createElement('a');
      const filename = `housing-market-${exportType}-${selectedMetric}-${new Date().toISOString().split('T')[0]}.png`;
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Export map as PNG">
          <Download className="h-4 w-4 mr-2" aria-hidden="true" />
          Export Map
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" aria-hidden="true" />
            Export Map as PNG
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Export Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={exportType} onValueChange={(value: "national" | "state") => setExportType(value)}>
                <SelectTrigger aria-label="Select export type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="national">National Map</SelectItem>
                  <SelectItem value="state">State Map</SelectItem>
                </SelectContent>
              </Select>
              
              {exportType === "state" && (
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger aria-label="Select state">
                    <SelectValue placeholder="Select a state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state) => (
                      <SelectItem key={state.code} value={state.code}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
          
          <div className="text-sm text-muted-foreground">
            <p>The exported PNG will include:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Map visualization with current metric</li>
              <li>Legend and color scale</li>
              <li>Website watermark and timestamp</li>
              <li>Data source attribution</li>
            </ul>
          </div>
          
          <Button 
            onClick={handleExport} 
            disabled={isExporting || (exportType === "state" && !selectedState)}
            className="w-full"
            aria-label={isExporting ? "Exporting map..." : "Export map as PNG"}
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                Export PNG
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}