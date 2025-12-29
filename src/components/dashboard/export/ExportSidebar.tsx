import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ZipData } from "../map/types";
import { Download, FileImage, Search, X, Settings2, Microscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PrintStage, PrintStageRef } from "./PrintStage";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";
import { jsPDF, jsPDFOptions } from "jspdf";
import { toast } from "@/hooks/use-toast";
import { trackError } from "@/lib/analytics";

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

const STATE_MAP: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"
};

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
  const [showCities, setShowCities] = useState(false);
  
  const [isExporting, setIsExporting] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  
  const printStageRef = useRef<PrintStageRef>(null);

  // Debounce metro search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMetroSearch(metroSearch), 150);
    return () => clearTimeout(timer);
  }, [metroSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (metroContainerRef.current && !metroContainerRef.current.contains(event.target as Node)) {
        setIsMetroListOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset map readiness when core settings change
  useEffect(() => {
    setIsMapReady(false);
  }, [regionScope, selectedState, selectedMetro, selectedMetric, showCities]);

  const { availableStates, filteredMetros } = useMemo(() => {
    if (Object.keys(allZipData).length === 0) return { availableStates: [], filteredMetros: [] };
    
    const stateSet = new Set<string>();
    const metroSet = new Set<string>();
    
    for (const zip of Object.values(allZipData)) {
      const metricValue = zip[selectedMetric as keyof ZipData];
      const hasData = metricValue !== null && metricValue !== undefined;

      if (hasData) {
        if (zip.state) stateSet.add(zip.state);
        if (zip.metro) metroSet.add(zip.metro);
      }
    }

    const states = Array.from(stateSet)
      .map(code => ({
        code,
        name: STATE_MAP[code] || code
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    const metros = Array.from(metroSet);
    
    let filtered = metros;
    if (debouncedMetroSearch) {
      const query = debouncedMetroSearch.toLowerCase();

      filtered = metros.filter(m => m.toLowerCase().includes(query));

      filtered.sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const indexA = aLower.indexOf(query);
        const indexB = bLower.indexOf(query);

        if (indexA !== indexB) {
          return indexA - indexB; 
        }

        return a.localeCompare(b);
      });
    } else {
      filtered.sort((a, b) => a.localeCompare(b));
    }
      
    return { availableStates: states, filteredMetros: filtered };
  }, [allZipData, selectedMetric, debouncedMetroSearch]);

  const hasValidSelection = useMemo(() => {
    if (regionScope === 'national') return true;
    if (regionScope === 'state' && selectedState) return true;
    if (regionScope === 'metro' && selectedMetro) return true;
    return false;
  }, [regionScope, selectedState, selectedMetro]);

  const filteredData = useMemo(() => {
    if (!hasValidSelection) return [];
    if (Object.keys(allZipData).length === 0) return [];
    
    return Object.values(allZipData).filter(zip => {
      if (regionScope === 'state' && selectedState) return zip.state === selectedState;
      if (regionScope === 'metro' && selectedMetro) return zip.metro === selectedMetro;
      return true;
    });
  }, [allZipData, regionScope, selectedState, selectedMetro, hasValidSelection]);

  const regionName = useMemo(() => {
    if (regionScope === 'state') {
      return STATE_MAP[selectedState] || selectedState || "Select a state";
    }
    if (regionScope === 'metro') return selectedMetro || "Select a metro area";
    return "United States";
  }, [regionScope, selectedState, selectedMetro]);

  const isExportDisabled = () => {
    if (isExporting) return true;
    if (!isMapReady) return true;
    if (!hasValidSelection) return true;
    if (filteredData.length === 0) return true;
    return false;
  };

  const getButtonText = () => {
    if (isExporting) return "Exporting...";
    if (!hasValidSelection) {
      if (regionScope === 'state') return "Select a state";
      if (regionScope === 'metro') return "Select a metro";
    }
    if (!isMapReady && filteredData.length > 0) return "Rendering...";
    return `Export ${fileFormat.toUpperCase()}`;
  };

  const handleExport = useCallback(async () => {
    const element = printStageRef.current?.getElement();
    if (!element) return;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "map_export_click",
      export_settings: {
        format: fileFormat,
        metric: selectedMetric,
        scope: regionScope,
        region_name: regionName,
        include_legend: includeLegend,
        include_title: includeTitle
      }
    });

    setIsExporting(true);

    try {
      await new Promise(resolve => requestAnimationFrame(resolve));
      // Give maplibre a moment to ensure tiles are painted
      await new Promise(resolve => setTimeout(resolve, 500));

      const scale = 5; 
      const canvas = await html2canvas(element, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
      });

      if (fileFormat === "png") {
        const link = document.createElement("a");
        link.download = `Domapus-${selectedMetric}-${regionScope}.png`;
        link.href = canvas.toDataURL("image/png", 1.0);
        link.click();
      } else {
        const imgData = canvas.toDataURL("image/png", 1.0);
        const options: jsPDFOptions = {
          orientation: "l",
          unit: "mm",
          format: "a4",
        };
        const pdf = new jsPDF(options);

        pdf.setProperties({
          title: `Domapus Export - ${selectedMetric}`,
          subject: `Real Estate Data for ${regionName}`,
          creator: 'Domapus (https://jasperc2024.github.io/Domapus/)',
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgAspect = canvas.width / canvas.height;
        const pdfAspect = pdfWidth / pdfHeight;
        
        let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;
        
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
        const stageRect = element.getBoundingClientRect();
        const links = element.querySelectorAll('a');

        links.forEach((link) => {
          const linkRect = link.getBoundingClientRect();
          const relX = (linkRect.left - stageRect.left) / stageRect.width;
          const relY = (linkRect.top - stageRect.top) / stageRect.height;
          const relW = linkRect.width / stageRect.width;
          const relH = linkRect.height / stageRect.height;

          const pdfX = offsetX + (relX * drawWidth);
          const pdfY = offsetY + (relY * drawHeight);
          const pdfW = relW * drawWidth;
          const pdfH = relH * drawHeight;

          pdf.link(pdfX, pdfY, pdfW, pdfH, { url: link.href });
        });
        pdf.save(`Domapus-${selectedMetric}-${regionScope}.pdf`);
      }

      toast({ title: "Export Complete", description: "Your map has been downloaded.", duration: 10000, });
    } catch (error: any) {
      console.error("Export failed:", error);
      trackError("export_failed", error?.message || "Unknown export error");
      toast({ title: "Export Failed", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }, [fileFormat, selectedMetric, regionScope, regionName, includeLegend, includeTitle]);

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
      <div className="w-80 bg-background border-r h-full shadow-xl flex flex-col">
        {/* Sidebar Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Download className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Export Settings</h2>
          </div>

          <div className="p-3 rounded-md border bg-muted/20 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Microscope className="h-3.5 w-3.5" />
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
                <SelectContent>{availableStates.map(state => (<SelectItem key={state.code} value={state.code}>{state.name}</SelectItem>))}</SelectContent>
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
                    onFocus={(e) => {setIsMetroListOpen(true);
                      const target = e.currentTarget;
                      setTimeout(() => target.select(), 0);
                    }}
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
          
          <div className="p-3 rounded-md border bg-muted/20 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileImage className="h-3.5 w-3.5" />
              <span>File Format</span>
            </div>
            <RadioGroup value={fileFormat} onValueChange={(v) => setFileFormat(v as any)} className="space-y-2">
              <div className="flex items-center space-x-2"><RadioGroupItem value="png" id="r-png" /><Label htmlFor="r-png" className="text-sm">PNG</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="pdf" id="r-pdf" /><Label htmlFor="r-pdf" className="text-sm">PDF</Label></div>
            </RadioGroup>
          </div>
          
          <div className="p-3 rounded-md border bg-muted/20 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Settings2 className="h-3.5 w-3.5" />
              <span>Customization</span>
              </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2"><Checkbox id="c-title" checked={includeTitle} onCheckedChange={(c) => setIncludeTitle(c === true)} /><Label htmlFor="c-title" className="text-sm">Include Title</Label></div>
              <div className="flex items-center space-x-2"><Checkbox id="c-legend" checked={includeLegend} onCheckedChange={(c) => setIncludeLegend(c === true)} /><Label htmlFor="c-legend" className="text-sm">Include Legend</Label></div>
              <div className="flex items-center space-x-2"><Checkbox id="c-cities" checked={showCities} onCheckedChange={(c) => setShowCities(c === true)} /><Label htmlFor="c-cities" className="text-sm">Show Cities</Label></div>
            </div>
          </div>
        </div>
        
        <div className="p-4 space-y-2 border-t bg-background">
          <Button id="btn-map-export" onClick={handleExport} disabled={isExportDisabled()} className="w-full" size="default">
            {(isExporting || (!isMapReady && hasValidSelection && filteredData.length > 0)) && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            )}
            {!isExporting && hasValidSelection && filteredData.length > 0 && isMapReady && (
              <Download className="h-4 w-4 mr-2" />
            )}
            {getButtonText()}
          </Button>
          <Button onClick={onClose} variant="outline" className="w-full" disabled={isExporting}>Cancel</Button>
        </div>
      </div>

      {/* Right Preview Area */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col bg-muted/30">
        <div className="mb-3 flex-shrink-0">
          <h3 className="text-base font-semibold text-foreground">Preview</h3>
          <p className="text-xs text-muted-foreground">
            {hasValidSelection ? `${filteredData.length.toLocaleString()} ZIP codes` : "Select a region to preview"}
          </p>
        </div>
        
        {/* Container for the PrintStage - Flex centered */}
        <div className="flex-1 flex items-center justify-center min-h-0 w-full">
          {hasValidSelection ? (
            <PrintStage
              ref={printStageRef}
              filteredData={filteredData}
              selectedMetric={selectedMetric}
              regionScope={regionScope}
              regionName={regionName}
              includeLegend={includeLegend}
              includeTitle={includeTitle}
              showCities={showCities}
              onReady={() => setIsMapReady(true)}
            />
          ) : (
            <div className="bg-white/50 border border-dashed rounded-lg w-full h-full flex items-center justify-center text-muted-foreground">
              {regionScope === 'state' ? "Select a state to preview" : "Select a metro area to preview"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}