import { useState, useMemo } from "react";
import { ZipData } from "./map/types";
import { Download, Settings, Map as MapIcon, FileImage, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ExportPreviewMap } from "./ExportPreviewMap";

// Defines the shape of the data this component sends back to its parent
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
  fullGeoJSON: GeoJSON.FeatureCollection | null;
  selectedMetric: string;
  isExporting: boolean;
  onExport: (options: ExportOptions) => void;
  onCancel: () => void;
}

export function ExportSidebar({ allZipData, fullGeoJSON, selectedMetric, isExporting, onExport, onCancel }: ExportSidebarProps) {
  const [regionScope, setRegionScope] = useState<"national" | "state" | "metro">("national");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedMetro, setSelectedMetro] = useState<string>("");
  const [metroSearch, setMetroSearch] = useState<string>("");
  const [fileFormat, setFileFormat] = useState<"png" | "pdf">("png");
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeTitle, setIncludeTitle] = useState(true);

  const { availableStates, filteredMetros } = useMemo(() => {
    if (Object.keys(allZipData).length === 0) return { availableStates: [], filteredMetros: [] };
    const stateSet = new Set<string>();
    const metroSet = new Set<string>();
    for (const zip of Object.values(allZipData)) {
      if (zip.state) stateSet.add(zip.state);
      if (zip.parent_metro) metroSet.add(zip.parent_metro);
    }
    const metros = Array.from(metroSet).sort();
    const filtered = metroSearch 
      ? metros.filter(m => m.toLowerCase().includes(metroSearch.toLowerCase()))
      : metros;
    return { availableStates: Array.from(stateSet).sort(), filteredMetros: filtered };
  }, [allZipData, metroSearch]);

  const { filteredData, filteredGeoJSON } = useMemo(() => {
    if (Object.keys(allZipData).length === 0 || !fullGeoJSON) {
      return { filteredData: [], filteredGeoJSON: null };
    }
    
    const filteredZips = Object.values(allZipData).filter(zip => {
      if (regionScope === 'state' && selectedState) {
        return zip.state === selectedState;
      }
      if (regionScope === 'metro' && selectedMetro) {
        return zip.parent_metro === selectedMetro;
      }
      return true;
    });

    const filteredZipCodes = new Set(filteredZips.map(z => z.zipCode));
    const filteredFeatures = fullGeoJSON.features.filter(f =>
      filteredZipCodes.has(f.properties?.zipCode)
    );

    return {
      filteredData: filteredZips,
      filteredGeoJSON: { type: "FeatureCollection", features: filteredFeatures } as GeoJSON.FeatureCollection
    };
  }, [allZipData, fullGeoJSON, regionScope, selectedState, selectedMetro]);

  const handleExportClick = () => {
    onExport({ regionScope, selectedState, selectedMetro, fileFormat, includeLegend, includeTitle });
  };

  const isExportDisabled = () => {
    if (isExporting) return true;
    if (regionScope === "state" && !selectedState) return true;
    if (regionScope === "metro" && !selectedMetro) return true;
    return false;
  };

  // --- FIX: Create type-safe handlers for the RadioGroup components ---
  const handleScopeChange = (value: string) => setRegionScope(value as "national" | "state" | "metro");
  const handleFormatChange = (value: string) => setFileFormat(value as "png" | "pdf");

  return (
    <div className="fixed inset-0 bg-background z-50 flex">
      {/* Left Sidebar - Settings */}
      <div className="w-80 bg-background border-r h-full overflow-y-auto shadow-xl flex flex-col">
        <div className="p-6 space-y-6 flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Settings className="h-5 w-5 text-primary" /></div>
            <div>
              <h2 className="text-lg font-semibold">Export Map</h2>
              <p className="text-sm text-muted-foreground">Configure settings</p>
            </div>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MapIcon className="h-4 w-4" />Region Scope</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={regionScope} onValueChange={handleScopeChange}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="national" id="r-national" /><Label htmlFor="r-national">National</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="state" id="r-state" /><Label htmlFor="r-state">State</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="metro" id="r-metro" /><Label htmlFor="r-metro">Metro Area</Label></div>
              </RadioGroup>
              {regionScope === 'state' && (
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger><SelectValue placeholder="Select a state"/></SelectTrigger>
                  <SelectContent>{availableStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {regionScope === 'metro' && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search metro areas..."
                      value={metroSearch}
                      onChange={(e) => setMetroSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Select value={selectedMetro} onValueChange={setSelectedMetro}>
                    <SelectTrigger><SelectValue placeholder="Select a metro area"/></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {filteredMetros.length > 0 ? (
                        filteredMetros.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No results</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileImage className="h-4 w-4" />File Format</CardTitle></CardHeader>
            <CardContent>
              <RadioGroup value={fileFormat} onValueChange={handleFormatChange}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="png" id="r-png" /><Label htmlFor="r-png">PNG (Image)</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="pdf" id="r-pdf" /><Label htmlFor="r-pdf">PDF (Document)</Label></div>
              </RadioGroup>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle className="text-sm">Customization</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center space-x-2"><Checkbox id="c-title" checked={includeTitle} onCheckedChange={(c) => setIncludeTitle(c === true)} /><Label htmlFor="c-title">Include Title</Label></div>
              <div className="flex items-center space-x-2"><Checkbox id="c-legend" checked={includeLegend} onCheckedChange={(c) => setIncludeLegend(c === true)} /><Label htmlFor="c-legend">Include Legend</Label></div>
            </CardContent>
          </Card>
        </div>
        
        <div className="p-6 pt-0 space-y-3 border-t">
          <Button onClick={handleExportClick} disabled={isExportDisabled()} className="w-full" size="lg">
            <Download className="h-4 w-4 mr-2" />Export {fileFormat.toUpperCase()}
          </Button>
          <Button onClick={onCancel} variant="outline" className="w-full" disabled={isExporting}>Cancel</Button>
        </div>
      </div>

      {/* Right Preview Area */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Preview</h3>
          <p className="text-sm text-muted-foreground">
            {filteredData.length.toLocaleString()} ZIP codes • {regionScope === 'national' ? 'United States' : regionScope === 'state' ? selectedState || 'Select a state' : selectedMetro || 'Select a metro area'}
          </p>
        </div>
        <div className="flex-1 bg-white border rounded-lg overflow-hidden shadow-sm">
          <ExportPreviewMap
            filteredZipData={filteredData}
            filteredGeoJSON={filteredGeoJSON}
            selectedMetric={selectedMetric}
            isLoading={false}
          />
        </div>
      </div>
    </div>
  );
}