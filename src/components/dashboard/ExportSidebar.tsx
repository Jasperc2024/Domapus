import { useState } from "react";
import { Download, FileImage, FileText, Settings, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

interface ExportSidebarProps {
  selectedMetric: string;
  onExport: (options: ExportOptions) => void;
  onCancel: () => void;
  isExporting: boolean;
}

export interface ExportOptions {
  regionScope: 'national' | 'state' | 'metro';
  selectedState?: string;
  selectedMetro?: string;
  fileFormat: 'png' | 'pdf';
  includeLegend: boolean;
  includeTitle: boolean;
  includeDateLabel: boolean;
  includeAttribution: boolean;
}

const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" }
];

const METRO_AREAS = [
  "New York-Newark-Jersey City, NY-NJ-PA",
  "Los Angeles-Long Beach-Anaheim, CA",
  "Chicago-Naperville-Elgin, IL-IN-WI",
  "Dallas-Fort Worth-Arlington, TX",
  "Houston-The Woodlands-Sugar Land, TX",
  "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD",
  "Atlanta-Sandy Springs-Roswell, GA",
  "Boston-Cambridge-Newton, MA-NH",
  "Phoenix-Mesa-Scottsdale, AZ",
  "San Francisco-Oakland-Hayward, CA",
  "Riverside-San Bernardino-Ontario, CA",
  "Detroit-Warren-Dearborn, MI",
  "Seattle-Tacoma-Bellevue, WA",
  "Minneapolis-St. Paul-Bloomington, MN-WI",
  "San Diego-Carlsbad, CA",
  "Tampa-St. Petersburg-Clearwater, FL",
  "Denver-Aurora-Lakewood, CO",
  "St. Louis, MO-IL"
];

export function ExportSidebar({ selectedMetric, onExport, onCancel, isExporting }: ExportSidebarProps) {
  const [regionScope, setRegionScope] = useState<'national' | 'state' | 'metro'>('national');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedMetro, setSelectedMetro] = useState<string>('');
  const [fileFormat, setFileFormat] = useState<'png' | 'pdf'>('png');
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeTitle, setIncludeTitle] = useState(true);

  const getMetricDisplayName = (metric: string) => {
    const metricNames: Record<string, string> = {
      'median-sale-price': 'Median Sale Price',
      'median-list-price': 'Median List Price',
      'median-dom': 'Median Days on Market',
      'inventory': 'Inventory',
      'new-listings': 'New Listings',
      'homes-sold': 'Homes Sold',
      'sale-to-list-ratio': 'Sale to List Ratio',
      'homes-sold-above-list': 'Homes Sold Above List',
      'off-market-2-weeks': 'Off Market in 2 Weeks'
    };
    return metricNames[metric] || metric;
  };

  const getRegionDisplayName = () => {
    if (regionScope === 'national') return 'United States';
    if (regionScope === 'state') return US_STATES.find(s => s.code === selectedState)?.name || selectedState;
    if (regionScope === 'metro') return selectedMetro;
    return '';
  };

  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleExport = () => {
    const options: ExportOptions = {
      regionScope,
      selectedState: regionScope === 'state' ? selectedState : undefined,
      selectedMetro: regionScope === 'metro' ? selectedMetro : undefined,
      fileFormat,
      includeLegend,
      includeTitle,
      includeDateLabel: true,
      includeAttribution: true
    };
    onExport(options);
  };

  const isExportDisabled = () => {
    if (isExporting) return true;
    if (regionScope === 'state' && !selectedState) return true;
    if (regionScope === 'metro' && !selectedMetro) return true;
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
            <p className="text-sm text-muted-foreground">Configure your export settings</p>
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
            <RadioGroup value={regionScope} onValueChange={(value: 'national' | 'state' | 'metro') => setRegionScope(value)}>
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

            {regionScope === 'state' && (
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {regionScope === 'metro' && (
              <Select value={selectedMetro} onValueChange={setSelectedMetro}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a metro area" />
                </SelectTrigger>
                <SelectContent>
                  {METRO_AREAS.map((metro) => (
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
            <RadioGroup value={fileFormat} onValueChange={(value: 'png' | 'pdf') => setFileFormat(value)}>
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
                onCheckedChange={(checked) => setIncludeLegend(checked === true)}
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
                <span className="font-medium">Title:</span> {getMetricDisplayName(selectedMetric)} by ZIP Code - {getRegionDisplayName()}, {getCurrentDate()}
              </div>
            )}
            <div>
              <span className="font-medium">Date:</span> Data as of {getCurrentDate()}
            </div>
            <div>
              <span className="font-medium">Attribution:</span> Data sourced from Redfin. Created with Domapus.
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