import { useMemo } from 'react';
import { ZipData } from '../components/dashboard/map/types';

interface ExportOptions {
  regionScope: "national" | "state" | "metro";
  selectedState?: string;
  selectedMetro?: string;
}

/**
 * A hook that takes the full dataset and filters it based on export options.
 * This is extremely fast because it's an in-memory operation.
 */
export function useFilteredData(allZipData: Record<string, ZipData>, options: ExportOptions) {
  const filteredZipData = useMemo(() => {
    if (Object.keys(allZipData).length === 0) {
      return [];
    }
    
    return Object.values(allZipData).filter(zip => {
      if (options.regionScope === "state" && options.selectedState) {
        return zip.state === options.selectedState;
      }
      if (options.regionScope === "metro" && options.selectedMetro) {
        return zip.parent_metro === options.selectedMetro;
      }
      return true; // National scope, no filter needed
    });
  }, [allZipData, options]);

  return filteredZipData;
}