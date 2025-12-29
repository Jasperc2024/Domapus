import { useState, useEffect, lazy, Suspense } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZipData } from "./dashboard/map/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";

const ExportSidebar = lazy(() => import("./dashboard/export/ExportSidebar").then(m => ({ default: m.ExportSidebar })));

interface MapExportProps {
  allZipData: Record<string, ZipData>;
  selectedMetric: string;
  onExportModeChange: (isExportMode: boolean) => void;
}

export function MapExport({ allZipData, selectedMetric, onExportModeChange }: MapExportProps) {
  const [isExportMode, setIsExportMode] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    onExportModeChange(isExportMode);
  }, [isExportMode, onExportModeChange]);

  const handleClose = () => {
    setIsExportMode(false);
  };

  const handleExportClick = () => {
    if (isMobile) {
      toast({
        title: "Desktop Only",
        description: "Sorry, the Export feature is only available on desktop.",
        variant: "destructive",
      });
      return;
    }
    setIsExportMode(true);
  };

  if (isExportMode && !isMobile) {
    return (
      <Suspense fallback={
        <div className="absolute right-0 top-0 h-full w-80 bg-dashboard-panel border-l border-dashboard-border flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }>
        <ExportSidebar
          allZipData={allZipData}
          selectedMetric={selectedMetric}
          onClose={handleClose}
        />
      </Suspense>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExportClick}>
      <Download className="h-4 w-4" />
      {!isMobile && <span>Export</span>}
    </Button>
  );
}
