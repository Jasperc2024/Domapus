import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import { ZipData } from './map/types'; // Import the single source of truth for the data type

// Define the props this component now accepts from its parent (Sidebar)
interface ZipComparisonProps {
  currentZip: ZipData;
  allZipData: Record<string, ZipData>; // It now receives the full dataset
  onClose: () => void;
}

export function ZipComparison({ currentZip, allZipData, onClose }: ZipComparisonProps) {
  // Local UI state for the search input and results
  const [searchZip, setSearchZip] = useState('');
  const [compareZip, setCompareZip] = useState<ZipData | null>(null);
  const [error, setError] = useState('');

  // The search is now an instant, in-memory lookup. No loading state is needed.
  const handleSearch = () => {
    if (!searchZip.trim()) return;
    
    setError('');
    const foundZip = allZipData[searchZip.trim()];

    if (foundZip) {
      setCompareZip(foundZip);
    } else {
      setError('ZIP code not found in our database.');
      setCompareZip(null);
    }
  };

  // Helper function to format display values
  const formatValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return 'N/A';
    const numValue = Number(value);
    if (isNaN(numValue)) return 'N/A';
    switch (type) {
      case 'price': return `$${numValue.toLocaleString()}`;
      case 'days': return `${numValue} days`;
      case 'percentage': return `${numValue.toFixed(1)}%`;
      case 'ratio': return `${(numValue * 100).toFixed(1)}%`;
      default: return numValue.toLocaleString();
    }
  };

  // Helper function to determine which value is higher or lower
  const getComparison = (current: any, compare: any): 'higher' | 'lower' | 'same' => {
    const currentNum = Number(current);
    const compareNum = Number(compare);
    if (isNaN(currentNum) || isNaN(compareNum)) return 'same';

    const diff = currentNum - compareNum;
    if (Math.abs(diff) < 0.01) return 'same'; // Treat very small differences as the same
    return diff > 0 ? 'higher' : 'lower';
  };

  // The list of metrics to compare
  const metrics = [
    { key: "median_sale_price", label: "Median Sale Price", type: "price" },
    { key: "median_list_price", label: "Median List Price", type: "price" },
    { key: "median_ppsf", label: "Median Price per Sq Ft", type: "price" },
    { key: "homes_sold", label: "Homes Sold", type: "number" },
    { key: "pending_sales", label: "Pending Sales", type: "number" },
    { key: "new_listings", label: "New Listings", type: "number" },
    { key: "inventory", label: "Inventory", type: "number" },
    { key: "median_dom", label: "Median Days on Market", type: "days" },
    { key: "avg_sale_to_list_ratio", label: "Sale-to-List Ratio", type: "ratio" },
    { key: "sold_above_list", label: "% Sold Above List", type: "percentage" },
    { key: "off_market_in_two_weeks", label: "% Off Market in 2 Weeks", type: "percentage" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-dashboard-text-primary">Compare ZIP Codes</h3>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close comparison">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex space-x-2">
        <Input
          type="text"
          pattern="[0-9]*"
          inputMode="numeric"
          maxLength={5}
          placeholder="Enter ZIP code..."
          value={searchZip}
          onChange={(e) => setSearchZip(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          aria-label="ZIP code to compare"
        />
        <Button onClick={handleSearch} size="sm" aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {error && <div className="text-sm text-red-500 p-2 rounded bg-red-50">{error}</div>}

      {compareZip && (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div><Badge variant="secondary">{currentZip.zipCode}</Badge><div className="text-xs text-muted-foreground mt-1">{currentZip.city}</div></div>
            <div className="text-xs text-muted-foreground self-center">vs</div>
            <div><Badge variant="secondary">{compareZip.zipCode}</Badge><div className="text-xs text-muted-foreground mt-1">{compareZip.city}</div></div>
          </div>

          <div className="space-y-2">
            {metrics.map((metric) => {
              const currentValue = currentZip[metric.key as keyof ZipData];
              const compareValue = compareZip[metric.key as keyof ZipData];
              const comparison = getComparison(currentValue, compareValue);
              const isGoodHigher = !metric.key.includes('dom'); // Higher is better for most metrics, except Days on Market

              return (
                <Card key={metric.key}>
                  <CardContent className="p-3">
                    <div className="text-center mb-2 text-xs font-medium text-muted-foreground">{metric.label}</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`text-center font-bold text-sm ${comparison === 'higher' ? (isGoodHigher ? 'text-green-600' : 'text-red-600') : comparison === 'lower' ? (isGoodHigher ? 'text-red-600' : 'text-green-600') : ''}`}>{formatValue(currentValue, metric.type)}</div>
                      <div className={`text-center font-bold text-sm ${comparison === 'lower' ? (isGoodHigher ? 'text-green-600' : 'text-red-600') : comparison === 'higher' ? (isGoodHigher ? 'text-red-600' : 'text-green-600') : ''}`}>{formatValue(compareValue, metric.type)}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}