import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ZipData } from "../map/types";
import { Download, Settings, Map as MapIcon, FileImage, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PrintStage, PrintStageRef } from "./PrintStage";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "@/hooks/use-toast";

export interface ExportOptions {
  regionScope: "national" | "state" | "metro";
  selectedState?: string;
  selectedMetro?: string;
  fileFormat: "png" | "pdf";
  includeLegend: boolean;
  includeTitle: boolean;
}

interface ExportSidebarProps {
  allZipData: Record<string, ZipData>;
  selectedMetric: string;
  onClose: () => void;
}

export function ExportSidebar({ allZipData, selectedMetric, onClose }: ExportSidebarProps) {
  const [regionScope, setRegionScope] = useState<"national" | "state" | "metro">("national");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedMetro, setSelectedMetro] = useState<string>("");
  
  // Metro Search States
  const [metroSearch, setMetroSearch] = useState<string>("");
  const [debouncedMetroSearch, setDebouncedMetroSearch] = useState<string>("");
  const [isMetroListOpen, setIsMetroListOpen] = useState(false);
  const metroContainerRef = useRef<HTMLDivElement>(null);

  const [fileFormat, setFileFormat] = useState<"png" | "pdf">("png");
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeTitle, setIncludeTitle] = useState(true);
  
  const [isExporting, setIsExporting] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false); // New state to track map readiness
  
  const printStageRef = useRef<PrintStageRef>(null);

  // Debounce metro search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMetroSearch(metroSearch), 150);
    return () => clearTimeout(timer);
  }, [metroSearch]);

  // Click outside to close metro list
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (metroContainerRef.current && !metroContainerRef.current.contains(event.target as Node)) {
        setIsMetroListOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset map readiness when core data/settings change
  useEffect(() => {
    setIsMapReady(false);
  }, [regionScope, selectedState, selectedMetro, selectedMetric, includeLegend, includeTitle]);

  const { availableStates, filteredMetros } = useMemo(() => {
    if (Object.keys(allZipData).length === 0) return { availableStates: [], filteredMetros: [] };
    
    const stateSet = new Set<string>();
    const metroSet = new Set<string>();
    
    for (const zip of Object.values(allZipData)) {
      if (zip.state) stateSet.add(zip.state);
      if (zip.parent_metro) metroSet.add(zip.parent_metro);
    }
    
    const metros = Array.from(metroSet).sort();
    const filtered = debouncedMetroSearch 
      ? metros.filter(m => m.toLowerCase().includes(debouncedMetroSearch.toLowerCase()))
      : metros;
      
    return { availableStates: Array.from(stateSet).sort(), filteredMetros: filtered };
  }, [allZipData, debouncedMetroSearch]);

  const filteredData = useMemo(() => {
    if (Object.keys(allZipData).length === 0) return [];
    
    return Object.values(allZipData).filter(zip => {
      if (regionScope === 'state' && selectedState) return zip.state === selectedState;
      if (regionScope === 'metro' && selectedMetro) return zip.parent_metro === selectedMetro;
      return true;
    });
  }, [allZipData, regionScope, selectedState, selectedMetro]);

  const regionName = useMemo(() => {
    if (regionScope === 'state') return selectedState || "Select a state";
    if (regionScope === 'metro') return selectedMetro || "Select a metro area";
    return "United States";
  }, [regionScope, selectedState, selectedMetro]);

  const isExportDisabled = () => {
    if (isExporting) return true;
    if (!isMapReady) return true; // Prevent export if map is loading
    if (regionScope === "state" && !selectedState) return true;
    if (regionScope === "metro" && !selectedMetro) return true;
    if (filteredData.length === 0) return true;
    return false;
  };

  const handleExport = useCallback(async () => {
    const element = printStageRef.current?.getElement();
    if (!element) return;

    setIsExporting(true);

    try {
      // Small delay to allow UI to update "Exporting..." state
      await new Promise(resolve => requestAnimationFrame(resolve));

      const scale = 3
      const canvas = await html2canvas(element, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
      });

      if (fileFormat === "png") {
        const link = document.createElement("a");
        link.download = `domapus-${selectedMetric}-${regionScope}.png`;
        link.href = canvas.toDataURL("image/png", 1.0);
        link.click();
      } else {
        // PDF - Landscape A4
        const imgData = canvas.toDataURL("image/png", 1.0);
        const pdf = new jsPDF({ 
          orientation: "landscape", 
          unit: "pt", 
          format: "a4" 
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        // Calculate aspect ratio
        const imgAspect = canvas.width / canvas.height;
        const pdfAspect = pdfWidth / pdfHeight;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgAspect > pdfAspect) {
          drawWidth = pdfWidth;
          drawHeight = pdfWidth / imgAspect;
          offsetX = 0;
          offsetY = (pdfHeight - drawHeight) / 2;
        } else {
          drawHeight = pdfHeight;
          drawWidth = pdfHeight * imgAspect;
          offsetX = (pdfWidth - drawWidth) / 2;
          offsetY = 0;
        }
        
        pdf.addImage(imgData, "PNG", offsetX, offsetY, drawWidth, drawHeight);
        pdf.save(`domapus-${selectedMetric}-${regionScope}.pdf`);
      }

      toast({ title: "Export Complete", description: "Your map has been downloaded." });
    } catch (error) {
      console.error("Export failed:", error);
      toast({ title: "Export Failed", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }, [fileFormat, selectedMetric, regionScope]);

  const selectMetro = (metroName: string) => {
    setSelectedMetro(metroName);
    setMetroSearch(metroName);
    setIsMetroListOpen(false);
  };

  const clearMetroSelection = () => {
    setSelectedMetro("");
    setMetroSearch("");
    setDebouncedMetroSearch("");
    setIsMetroListOpen(true);
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex">
      {/* Left Sidebar - Settings */}
      <div className="w-80 bg-background border-r h-full shadow-xl flex flex-col">
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Settings className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Export Map</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapIcon className="h-3.5 w-3.5" />
              <span>Region Scope</span>
            </div>
            <RadioGroup value={regionScope} onValueChange={(v) => setRegionScope(v as any)} className="space-y-2">
              <div className="flex items-center space-x-2"><RadioGroupItem value="national" id="r-national" /><Label htmlFor="r-national" className="text-sm">National</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="state" id="r-state" /><Label htmlFor="r-state" className="text-sm">State</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="metro" id="r-metro" /><Label htmlFor="r-metro" className="text-sm">Metro Area</Label></div>
            </RadioGroup>
            
            {regionScope === 'state' && (
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select a state"/></SelectTrigger>
                <SelectContent>{availableStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            )}

            {regionScope === 'metro' && (
              <div className="space-y-2 relative" ref={metroContainerRef}>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type to search metros..."
                    value={metroSearch}
                    onChange={(e) => {
                      setMetroSearch(e.target.value);
                      setIsMetroListOpen(true);
                      if (selectedMetro && e.target.value !== selectedMetro) setSelectedMetro("");
                    }}
                    onFocus={() => setIsMetroListOpen(true)}
                    className="pl-8 h-9 pr-8"
                  />
                  {metroSearch && (
                    <button onClick={clearMetroSelection} className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                {isMetroListOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-[250px] overflow-y-auto">
                    {filteredMetros.length > 0 ? (
                      <div className="p-1">
                        {filteredMetros.map((m) => (
                          <div
                            key={m}
                            onClick={() => selectMetro(m)}
                            className={cn(
                              "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                              selectedMetro === m && "bg-accent text-accent-foreground font-medium"
                            )}
                          >
                            {m}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-sm text-muted-foreground">No metro areas found.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileImage className="h-3.5 w-3.5" />
              <span>File Format</span>
            </div>
            <RadioGroup value={fileFormat} onValueChange={(v) => setFileFormat(v as any)} className="space-y-2">
              <div className="flex items-center space-x-2"><RadioGroupItem value="png" id="r-png" /><Label htmlFor="r-png" className="text-sm">PNG (Image)</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="pdf" id="r-pdf" /><Label htmlFor="r-pdf" className="text-sm">PDF (Document)</Label></div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2 pt-2">
            <div className="text-sm font-medium">Customization</div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2"><Checkbox id="c-title" checked={includeTitle} onCheckedChange={(c) => setIncludeTitle(c === true)} /><Label htmlFor="c-title" className="text-sm">Include Title</Label></div>
              <div className="flex items-center space-x-2"><Checkbox id="c-legend" checked={includeLegend} onCheckedChange={(c) => setIncludeLegend(c === true)} /><Label htmlFor="c-legend" className="text-sm">Include Legend</Label></div>
            </div>
          </div>
        </div>
        
        <div className="p-4 space-y-2 border-t bg-background">
          <Button onClick={handleExport} disabled={isExportDisabled()} className="w-full" size="default">
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Exporting...
              </>
            ) : !isMapReady && filteredData.length > 0 ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Rendering...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {fileFormat.toUpperCase()}
              </>
            )}
          </Button>
          <Button onClick={onClose} variant="outline" className="w-full" disabled={isExporting}>Cancel</Button>
        </div>
      </div>

      {/* Right Preview Area */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col bg-gray-100">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-gray-700">Preview</h3>
          <p className="text-xs text-gray-500">
            {filteredData.length.toLocaleString()} ZIP codes
          </p>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div 
            className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200"
            style={{ 
              width: '100%', 
              maxWidth: '900px',
              aspectRatio: '4 / 3'
            }}
          >
            <PrintStage
              ref={printStageRef}
              filteredData={filteredData}
              selectedMetric={selectedMetric}
              regionScope={regionScope}
              regionName={regionName}
              includeLegend={includeLegend}
              includeTitle={includeTitle}
              onReady={() => setIsMapReady(true)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}