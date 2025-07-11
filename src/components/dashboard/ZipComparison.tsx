
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import pako from 'pako';

interface ZipData {
  zipCode: string;
  state: string;
  city?: string;
  median_sale_price?: number;
  median_list_price?: number;
  median_dom?: number;
  inventory?: number;
  new_listings?: number;
  homes_sold?: number;
  avg_sale_to_list_ratio?: number;
  sold_above_list?: number;
  off_market_in_two_weeks?: number;
}

interface ZipComparisonProps {
  currentZip: ZipData;
  onClose: () => void;
}

export function ZipComparison({ currentZip, onClose }: ZipComparisonProps) {
  const [searchZip, setSearchZip] = useState('');
  const [compareZip, setCompareZip] = useState<ZipData | null>(null);
  const [allZipData, setAllZipData] = useState<Record<string, any>>({});
  const [citiesData, setCitiesData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load ZIP data
        const zipResponse = await fetch('data/zip-data.json.gz');
        const zipBuffer = await zipResponse.arrayBuffer();
        const zipDecompressed = pako.ungzip(new Uint8Array(zipBuffer), { to: 'string' });
        const zipJson = JSON.parse(zipDecompressed);
        setAllZipData(zipJson);

        // Load cities mapping
        const citiesResponse = await fetch('data/zip-city-mapping.csv.gz');
        const citiesBuffer = await citiesResponse.arrayBuffer();
        const citiesDecompressed = pako.ungzip(new Uint8Array(citiesBuffer), { to: 'string' });

        const citiesMap: Record<string, string> = {};
        citiesDecompressed.split('\n').slice(1).forEach(line => {
          const [zip, city] = line.split(',');
          if (zip && city) {
            citiesMap[zip.trim()] = city.trim();
          }
        });
        setCitiesData(citiesMap);

      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  const handleSearch = async () => {
    if (!searchZip.trim()) return;
    
    setLoading(true);
    setError('');

    try {
      const zipData = allZipData[searchZip.trim()];
      if (zipData) {
        const enhancedData = {
          ...zipData,
          zipCode: searchZip.trim(),
          city: citiesData[searchZip.trim()] || zipData.city || 'Unknown',
        };
        setCompareZip(enhancedData);
      } else {
        setError('ZIP code not found in database');
        setCompareZip(null);
      }
    } catch (error) {
      setError('Error searching for ZIP code');
      setCompareZip(null);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return 'N/A';
    
    const numValue = Number(value);
    switch (type) {
      case 'price':
        return `$${numValue.toLocaleString()}`;
      case 'days':
        return `${numValue} days`;
      case 'percentage':
        return numValue % 1 === 0 ? `${numValue.toFixed(0)}%` : `${numValue.toFixed(1)}%`;
      case 'ratio':
        const ratioPercent = numValue * 100;
        return ratioPercent % 1 === 0 ? `${ratioPercent.toFixed(0)}%` : `${ratioPercent.toFixed(1)}%`;
      default:
        return numValue % 1 === 0 ? numValue.toFixed(0) : numValue.toString();
    }
  };

  const getComparison = (current: any, compare: any): 'higher' | 'lower' | 'same' => {
    if (!current || !compare) return 'same';
    const diff = Number(current) - Number(compare);
    if (Math.abs(diff) < 0.01) return 'same';
    return diff > 0 ? 'higher' : 'lower';
  };

  const metrics = [
    { key: 'median_sale_price', label: 'Median Sale Price', type: 'price' },
    { key: 'median_list_price', label: 'Median List Price', type: 'price' },
    { key: 'median_dom', label: 'Median Days on Market', type: 'days' },
    { key: 'inventory', label: 'Inventory', type: 'number' },
    { key: 'new_listings', label: 'New Listings', type: 'number' },
    { key: 'homes_sold', label: 'Homes Sold', type: 'number' },
    { key: 'avg_sale_to_list_ratio', label: 'Sale-to-List Ratio', type: 'ratio' },
    { key: 'sold_above_list', label: '% Sold Above List', type: 'percentage' },
    { key: 'off_market_in_two_weeks', label: '% Off Market in 2 Weeks', type: 'percentage' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-dashboard-text-primary">
          Compare ZIP Codes
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search for comparison ZIP */}
      <div className="flex space-x-2">
        <Input
          placeholder="Enter ZIP code to compare"
          value={searchZip}
          onChange={(e) => setSearchZip(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          aria-label="ZIP code to compare"
        />
        <Button onClick={handleSearch} disabled={loading} size="sm">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {compareZip && (
        <div className="space-y-3">
          {/* Headers */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center">
              <Badge variant="outline" className="mb-1">
                {currentZip.zipCode}
              </Badge>
              <div className="text-xs text-dashboard-text-secondary">
                {currentZip.city}
              </div>
            </div>
            <div className="text-center text-xs text-dashboard-text-secondary">
              vs
            </div>
            <div className="text-center">
              <Badge variant="outline" className="mb-1">
                {compareZip.zipCode}
              </Badge>
              <div className="text-xs text-dashboard-text-secondary">
                {compareZip.city}
              </div>
            </div>
          </div>

          {/* Comparison table */}
          <div className="space-y-2">
            {metrics.map((metric) => {
              const currentValue = currentZip[metric.key as keyof ZipData];
              const compareValue = compareZip[metric.key as keyof ZipData];
              const comparison = getComparison(currentValue, compareValue);

              return (
                <Card key={metric.key} className="border-dashboard-border">
                  <CardContent className="p-3">
                    <div className="text-center mb-2">
                      <span className="text-xs text-dashboard-text-secondary font-medium">
                        {metric.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className={`font-medium text-sm ${
                          comparison === 'higher' ? 'text-green-600' : 
                          comparison === 'lower' ? 'text-red-600' : 
                          'text-dashboard-text-primary'
                        }`}>
                          {formatValue(currentValue, metric.type)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`font-medium text-sm ${
                          comparison === 'lower' ? 'text-green-600' : 
                          comparison === 'higher' ? 'text-red-600' : 
                          'text-dashboard-text-primary'
                        }`}>
                          {formatValue(compareValue, metric.type)}
                        </div>
                      </div>
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
