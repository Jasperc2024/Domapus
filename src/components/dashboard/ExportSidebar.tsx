import { useState, useMemo, useEffect, useRef } from "react";
import { ZipData } from "./map/types";
import { Download, Settings, Map as MapIcon, FileImage, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ExportPreviewMap } from "./ExportPreviewMap";
import { Legend } from "./Legend";
import { cn } from "@/lib/utils";

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
  isExporting: boolean;
  onExport: (options: ExportOptions) => void;
  onCancel: () => void;
}

export function ExportSidebar({ allZipData, selectedMetric, isExporting, onExport, onCancel }: ExportSidebarProps) {
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

  // Handle Debounce for Metro Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMetroSearch(metroSearch);
    }, 150); 

    return () => clearTimeout(timer);
  }, [metroSearch]);

  // Handle Click Outside to close suggestion list
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (metroContainerRef.current && !metroContainerRef.current.contains(event.target as Node)) {
        setIsMetroListOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    if (Object.keys(allZipData).length === 0) {
      return [];
    }
    
    return Object.values(allZipData).filter(zip => {
      if (regionScope === 'state' && selectedState) {
        return zip.state === selectedState;
      }
      if (regionScope === 'metro' && selectedMetro) {
        return zip.parent_metro === selectedMetro;
      }
      return true;
    });
  }, [allZipData, regionScope, selectedState, selectedMetro]);

  const handleExportClick = () => {
    onExport({ regionScope, selectedState, selectedMetro, fileFormat, includeLegend, includeTitle });
  };

  const isExportDisabled = () => {
    if (isExporting) return true;
    if (regionScope === "state" && !selectedState) return true;
    if (regionScope === "metro" && !selectedMetro) return true;
    return false;
  };

  const handleScopeChange = (value: string) => {
    setRegionScope(value as "national" | "state" | "metro");
    if (value !== 'metro') {
      setIsMetroListOpen(false);
    }
  };

  const handleFormatChange = (value: string) => setFileFormat(value as "png" | "pdf");

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
            <RadioGroup value={regionScope} onValueChange={handleScopeChange} className="space-y-2">
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
                      if (selectedMetro && e.target.value !== selectedMetro) {
                        setSelectedMetro("");
                      }
                    }}
                    onFocus={() => setIsMetroListOpen(true)}
                    className="pl-8 h-9 pr-8"
                  />
                  {metroSearch && (
                    <button 
                      onClick={clearMetroSelection}
                      className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                    >
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
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No metro areas found.
                      </div>
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
            <RadioGroup value={fileFormat} onValueChange={handleFormatChange} className="space-y-2">
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
          <Button onClick={handleExportClick} disabled={isExportDisabled()} className="w-full" size="default">
            <Download className="h-4 w-4 mr-2" />Export {fileFormat.toUpperCase()}
          </Button>
          <Button onClick={onCancel} variant="outline" className="w-full" disabled={isExporting}>Cancel</Button>
        </div>
      </div>

      {/* Right Preview Area */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col bg-gray-50">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Preview</h3>
          <p className="text-sm text-muted-foreground">
            {filteredData.length.toLocaleString()} ZIP codes • {regionScope === 'national' ? 'United States' : regionScope === 'state' ? selectedState || 'Select a state' : selectedMetro || 'Select a metro area'}
          </p>
        </div>
        <div className="flex-1 bg-white border rounded-lg overflow-hidden shadow-sm p-8 flex flex-col">
          {includeTitle && (
            <header className="text-center mb-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {selectedMetric.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} by ZIP Code
              </h1>
              <p className="text-sm text-gray-600">
                {regionScope === 'national' ? 'United States' : regionScope === 'state' ? selectedState || 'State' : selectedMetro || 'Metro Area'} • {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </header>
          )}
          <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 relative">
            {filteredData.length > 0 ? (
              <>
                <ExportPreviewMap
                  filteredData={filteredData}
                  selectedMetric={selectedMetric}
                  regionScope={regionScope}
                />
                {includeLegend && (
                  <div className="absolute bottom-4 right-4 w-64">
                    <Legend
                      selectedMetric={selectedMetric}
                      metricValues={filteredData
                        .map(d => d[selectedMetric as keyof ZipData] as number)
                        .filter(v => typeof v === "number" && v > 0)}
                      isExport={true}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {regionScope === 'state' && !selectedState && 'Select a state'}
                {regionScope === 'metro' && !selectedMetro && 'Select a metro area'}
                {filteredData.length === 0 && 'No data available'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
