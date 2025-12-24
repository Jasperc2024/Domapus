import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportSidebar } from "./dashboard/export/ExportSidebar";
import { ZipData } from "./dashboard/map/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";

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
        description: "Export feature is only available on desktop.",
        variant: "destructive",
      });
      return;
    }
    setIsExportMode(true);
  };

  if (isExportMode && !isMobile) {
    return (
      <ExportSidebar
        allZipData={allZipData}
        selectedMetric={selectedMetric}
        onClose={handleClose}
      />
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExportClick}>
      <Download className="h-4 w-4" />
      {!isMobile && <span>Export</span>}
    </Button>
  );
}
