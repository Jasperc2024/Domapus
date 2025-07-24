import { useState, useMemo } from "react";
import { ZipData } from "./map/types"; // Correctly imports the single source of truth for types
import { Download, Settings, Map as MapIcon, FileImage, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

// Defines the shape of the data this component sends back to its parent
export interface ExportOptions {
  regionScope: "national" | "state" | "metro";
  selectedState?: string;
  selectedMetro?: string;
  fileFormat: "png" | "pdf";
  includeLegend: boolean;
  includeTitle: boolean;
}

// Defines the props this component receives from its parent
interface ExportSidebarProps {
  allZipData: Record<string, ZipData>;
  isExporting: boolean;
  onExport: (options: ExportOptions) => void;
  onCancel: () => void;
}

export function ExportSidebar({ allZipData, isExporting, onExport, onCancel }: ExportSidebarProps) {
  // Local UI state for managing the form
  const [regionScope, setRegionScope] = useState<"national" | "state" | "metro">("national");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedMetro, setSelectedMetro] = useState<string>("");
  const [fileFormat, setFileFormat] = useState<"png" | "pdf">("png");
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeTitle, setIncludeTitle] = useState(true);

  // Instantly derives dropdown lists from the main data prop. This is fast and efficient.
  const { availableStates, availableMetros } = useMemo(() => {
    if (Object.keys(allZipData).length === 0) return { availableStates: [], availableMetros: [] };
    const stateSet = new Set<string>();
    const metroSet = new Set<string>();
    for (const zip of Object.values(allZipData)) {
      if (zip.state) stateSet.add(zip.state);
      if (zip.parent_metro) metroSet.add(zip.parent_metro);
    }
    return { availableStates: Array.from(stateSet).sort(), availableMetros: Array.from(metroSet).sort() };
  }, [allZipData]);

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
    <div className="absolute top-0 left-0 w-80 bg-background border-r h-full overflow-y-auto z-20 shadow-xl">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Settings className="h-5 w-5 text-primary" /></div>
            <div>
                <h2 className="text-lg font-semibold">Export Map</h2>
                <p className="text-sm text-muted-foreground">Configure your export settings</p>
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
                {regionScope === 'state' && <Select value={selectedState} onValueChange={setSelectedState}><SelectTrigger><SelectValue placeholder="Select a state"/></SelectTrigger><SelectContent>{availableStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>}
                {regionScope === 'metro' && <Select value={selectedMetro} onValueChange={setSelectedMetro}><SelectTrigger><SelectValue placeholder="Select a metro area"/></SelectTrigger><SelectContent>{availableMetros.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>}
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
        
        <Separator />
        
        <div className="space-y-3">
          <Button onClick={handleExportClick} disabled={isExportDisabled()} className="w-full" size="lg">
            {isExporting ? "Processing..." : <><Download className="h-4 w-4 mr-2" />Export {fileFormat.toUpperCase()}</>}
          </Button>
          <Button onClick={onCancel} variant="outline" className="w-full" disabled={isExporting}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}