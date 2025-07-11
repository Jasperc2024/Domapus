import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricType, METRICS } from "./MetricSelector";
import { useEffect, useState } from "react";
import { getMetricValue, getMetricDisplay } from "./map/utils";
import pako from 'pako';

interface LegendProps {
  selectedMetric: MetricType;
  exportOptions?: {
    regionScope?: 'national' | 'state' | 'metro';
    selectedState?: string;
    selectedMetro?: string;
  };
}

export function Legend({ selectedMetric, exportOptions }: LegendProps) {
  const [zipCount, setZipCount] = useState<number>(0);
  const [metricValues, setMetricValues] = useState<number[]>([]);

  useEffect(() => {
    // Load ZIP data to get actual count and values
    const loadData = async () => {
      try {
        // Load from compressed data
        const response = await fetch(import.meta.env.BASE_URL + 'data/zip-data.json.gz');
        const arrayBuffer = await response.arrayBuffer();
        const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), { to: 'string' });
        const data = JSON.parse(decompressed);

        // Filter data based on export options if provided
        let filteredData = data;
        if (exportOptions) {
          if (exportOptions.regionScope === 'state' && exportOptions.selectedState) {
            filteredData = Object.fromEntries(
              Object.entries(data).filter(([, zipData]: [string, any]) => 
                zipData.state === exportOptions.selectedState
              )
            );
          } else if (exportOptions.regionScope === 'metro' && exportOptions.selectedMetro) {
            filteredData = Object.fromEntries(
              Object.entries(data).filter(([, zipData]: [string, any]) => 
                zipData.parent_metro === exportOptions.selectedMetro
              )
            );
          }
        }

        setZipCount(Object.keys(filteredData).length);
        
        // Get all values for the selected metric from filtered data
        const values = Object.values(filteredData)
          .map((zipData: any) => getMetricValue(zipData, selectedMetric))
          .filter(v => v > 0)
          .sort((a, b) => a - b);
        
        setMetricValues(values);
      } catch (error) {
        console.error('Error loading legend data:', error);
        setZipCount(20000); // Fallback to default
        setMetricValues([]);
      }
    };

    loadData();
  }, [selectedMetric, exportOptions]);

  // Calculate actual metric range from data
  const getLegendValues = () => {
    if (metricValues.length === 0) {
      return { min: "No data", max: "No data", quintiles: [] };
    }
    
    const min = metricValues[0];
    const max = metricValues[metricValues.length - 1];
    
    // Calculate quintiles (5 equal parts)
    const quintiles = [];
    for (let i = 0; i <= 4; i++) {
      const index = Math.floor((metricValues.length - 1) * (i / 4));
      quintiles.push(metricValues[index]);
    }
    
    return {
      min: getMetricDisplay({ [selectedMetric.replace('-', '_')]: min }, selectedMetric),
      max: getMetricDisplay({ [selectedMetric.replace('-', '_')]: max }, selectedMetric),
      quintiles: quintiles.map(val => getMetricDisplay({ [selectedMetric.replace('-', '_')]: val }, selectedMetric))
    };
  };

  const { min, max, quintiles } = getLegendValues();

  return (
    <Card className="bg-dashboard-panel border-dashboard-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-dashboard-text-primary">
          {METRICS[selectedMetric]}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Color Scale */}
          <div className="relative">
            <div className="h-4 rounded-lg" style={{
              background: 'linear-gradient(to right, #497eaf, #5fa4ca, #b4d4ec, #ffecd4, #fac790, #e97000)'
            }}></div>
            <div className="flex justify-between text-xs text-dashboard-text-secondary mt-1">
              <span>{min}</span>
              <span>{max}</span>
            </div>
          </div>

          {/* Legend Labels */}
          <div className="grid grid-cols-5 gap-1 text-xs">
            {quintiles.map((value, index) => {
              const colors = ['#497eaf', '#5fa4ca', '#b4d4ec', '#fac790', '#e97000'];
              return (
                <div key={index} className="text-center">
                  <div className="w-3 h-3 rounded mx-auto mb-1" style={{ backgroundColor: colors[index] }}></div>
                  <span className="text-dashboard-text-secondary text-[10px]">{value}</span>
                </div>
              );
            })}
          </div>

          {/* Data Points Count */}
          <div className="text-xs text-dashboard-text-secondary text-center pt-2 border-t border-dashboard-border">
            Showing {zipCount.toLocaleString()} ZIP codes
          </div>
        </div>
      </CardContent>
    </Card>
  );
}