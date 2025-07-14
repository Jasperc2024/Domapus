import { useState, useEffect } from "react";
import { Download, FileImage, FileText, Settings, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import pako from "pako";

interface ExportSidebarProps {
  selectedMetric: string;
  onExport: (options: ExportOptions) => void;
  onCancel: () => void;
  isExporting: boolean;
}

export interface ExportOptions {
  regionScope: "national" | "state" | "metro";
  selectedState?: string;
  selectedMetro?: string;
  fileFormat: "png" | "pdf";
  includeLegend: boolean;
  includeTitle: boolean;
  includeDateLabel: boolean;
  includeAttribution: boolean;
}

// Dynamic state mapping - will be populated from data
const STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  Columbia: "DC",
};

export function ExportSidebar({
  selectedMetric,
  onExport,
  onCancel,
  isExporting,
}: ExportSidebarProps) {
  const [regionScope, setRegionScope] = useState<
    "national" | "state" | "metro"
  >("national");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedMetro, setSelectedMetro] = useState<string>("");
  const [fileFormat, setFileFormat] = useState<"png" | "pdf">("png");
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeTitle, setIncludeTitle] = useState(true);
  const [availableStates, setAvailableStates] = useState<
    Array<{ name: string; code: string }>
  >([]);
  const [availableMetros, setAvailableMetros] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load available states and metro areas from data
  useEffect(() => {
    const loadAvailableOptions = async () => {
      try {
        setIsLoadingData(true);

        // Load from compressed data
        const response = await fetch(
          "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/zip-data.json.gz",
        );
        const arrayBuffer = await response.arrayBuffer();
        const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), {
          to: "string",
        });
        const data = JSON.parse(decompressed);

        // Extract unique states and metros
        const stateNames = new Set<string>();
        const metroNames = new Set<string>();

        Object.values(data).forEach((zipData: any) => {
          if (zipData.state) {
            stateNames.add(zipData.state);
          }
          if (zipData.parent_metro) {
            metroNames.add(zipData.parent_metro);
          }
        });

        // Convert state names to state objects with codes
        const stateList = Array.from(stateNames)
          .map((name) => ({
            name,
            code:
              STATE_NAME_TO_CODE[name] || name.substring(0, 2).toUpperCase(),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const metroList = Array.from(metroNames).sort();

        setAvailableStates(stateList);
        setAvailableMetros(metroList);
      } catch (error) {
        console.error("Error loading available options:", error);
        // Fallback to hardcoded list
        setAvailableStates([
          { name: "Alabama", code: "AL" },
          { name: "Alaska", code: "AK" },
          { name: "Arizona", code: "AZ" },
          { name: "Arkansas", code: "AR" },
          { name: "California", code: "CA" },
          { name: "Colorado", code: "CO" },
          { name: "Connecticut", code: "CT" },
          { name: "Delaware", code: "DE" },
          { name: "Florida", code: "FL" },
          { name: "Georgia", code: "GA" },
          { name: "Hawaii", code: "HI" },
          { name: "Idaho", code: "ID" },
          { name: "Illinois", code: "IL" },
          { name: "Indiana", code: "IN" },
          { name: "Iowa", code: "IA" },
          { name: "Kansas", code: "KS" },
          { name: "Kentucky", code: "KY" },
          { name: "Louisiana", code: "LA" },
          { name: "Maine", code: "ME" },
          { name: "Maryland", code: "MD" },
          { name: "Massachusetts", code: "MA" },
          { name: "Michigan", code: "MI" },
          { name: "Minnesota", code: "MN" },
          { name: "Mississippi", code: "MS" },
          { name: "Missouri", code: "MO" },
          { name: "Montana", code: "MT" },
          { name: "Nebraska", code: "NE" },
          { name: "Nevada", code: "NV" },
          { name: "New Hampshire", code: "NH" },
          { name: "New Jersey", code: "NJ" },
          { name: "New Mexico", code: "NM" },
          { name: "New York", code: "NY" },
          { name: "North Carolina", code: "NC" },
          { name: "North Dakota", code: "ND" },
          { name: "Ohio", code: "OH" },
          { name: "Oklahoma", code: "OK" },
          { name: "Oregon", code: "OR" },
          { name: "Pennsylvania", code: "PA" },
          { name: "Rhode Island", code: "RI" },
          { name: "South Carolina", code: "SC" },
          { name: "South Dakota", code: "SD" },
          { name: "Tennessee", code: "TN" },
          { name: "Texas", code: "TX" },
          { name: "Utah", code: "UT" },
          { name: "Vermont", code: "VT" },
          { name: "Virginia", code: "VA" },
          { name: "Washington", code: "WA" },
          { name: "West Virginia", code: "WV" },
          { name: "Wisconsin", code: "WI" },
          { name: "Wyoming", code: "WY" },
        ]);
        setAvailableMetros([]);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadAvailableOptions();
  }, []);

  const getMetricDisplayName = (metric: string) => {
    const metricNames: Record<string, string> = {
      "median-sale-price": "Median Sale Price",
      "median-list-price": "Median List Price",
      "median-dom": "Median Days on Market",
      inventory: "Inventory",
      "new-listings": "New Listings",
      "homes-sold": "Homes Sold",
      "sale-to-list-ratio": "Sale to List Ratio",
      "homes-sold-above-list": "Homes Sold Above List",
      "off-market-2-weeks": "Off Market in 2 Weeks",
    };
    return metricNames[metric] || metric;
  };

  const getRegionDisplayName = () => {
    if (regionScope === "national") return "United States";
    if (regionScope === "state") {
      const state = availableStates.find((s) => s.name === selectedState);
      return state?.name || selectedState;
    }
    if (regionScope === "metro") return selectedMetro;
    return "";
  };

  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const handleExport = () => {
    const options: ExportOptions = {
      regionScope,
      selectedState: regionScope === "state" ? selectedState : undefined,
      selectedMetro: regionScope === "metro" ? selectedMetro : undefined,
      fileFormat,
      includeLegend,
      includeTitle,
      includeDateLabel: true,
      includeAttribution: true,
    };
    onExport(options);
  };

  const isExportDisabled = () => {
    if (isExporting || isLoadingData) return true;
    if (regionScope === "state" && !selectedState) return true;
    if (regionScope === "metro" && !selectedMetro) return true;
    return false;
  };

  return (
    <div className="w-80 bg-background border-r h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Export Map</h2>
            <p className="text-sm text-muted-foreground">
              Configure your export settings
            </p>
          </div>
        </div>

        {/* Region Scope */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Map className="h-4 w-4" />
              Region Scope
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={regionScope}
              onValueChange={(value: "national" | "state" | "metro") =>
                setRegionScope(value)
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="national" id="national" />
                <Label htmlFor="national">National</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="state" id="state" />
                <Label htmlFor="state">State</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="metro" id="metro" />
                <Label htmlFor="metro">Metro Area</Label>
              </div>
            </RadioGroup>

            {regionScope === "state" && (
              <Select
                value={selectedState}
                onValueChange={setSelectedState}
                disabled={isLoadingData}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingData ? "Loading states..." : "Select a state"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableStates.map((state) => (
                    <SelectItem key={state.name} value={state.name}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {regionScope === "metro" && (
              <Select
                value={selectedMetro}
                onValueChange={setSelectedMetro}
                disabled={isLoadingData}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingData
                        ? "Loading metro areas..."
                        : "Select a metro area"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableMetros.map((metro) => (
                    <SelectItem key={metro} value={metro}>
                      {metro}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* File Format */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileImage className="h-4 w-4" />
              File Format
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={fileFormat}
              onValueChange={(value: "png" | "pdf") => setFileFormat(value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="png" id="png" />
                <Label htmlFor="png">PNG (Image)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf">PDF (Document)</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Customization Options */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Customization Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="legend"
                checked={includeLegend}
                onCheckedChange={(checked) =>
                  setIncludeLegend(checked === true)
                }
              />
              <Label htmlFor="legend">Include legend</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="title"
                checked={includeTitle}
                onCheckedChange={(checked) => setIncludeTitle(checked === true)}
              />
              <Label htmlFor="title">Include title</Label>
            </div>
          </CardContent>
        </Card>

        {/* Preview Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Export Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {includeTitle && (
              <div>
                <span className="font-medium">Title:</span>{" "}
                {getMetricDisplayName(selectedMetric)} by ZIP Code -{" "}
                {getRegionDisplayName()}, {getCurrentDate()}
              </div>
            )}
            <div>
              <span className="font-medium">Date:</span> Data as of{" "}
              {getCurrentDate()}
            </div>
            <div>
              <span className="font-medium">Attribution:</span> Data sourced
              from Redfin. Created with Domapus.
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleExport}
            disabled={isExportDisabled()}
            className="w-full"
            size="lg"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Exporting...
              </>
            ) : isLoadingData ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Loading data...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {fileFormat.toUpperCase()}
              </>
            )}
          </Button>

          <Button
            onClick={onCancel}
            variant="outline"
            className="w-full"
            disabled={isExporting}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}