// PrintStage: The exact layout for both preview and export capture
import { useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import maplibregl, { ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ZipData } from "../map/types";
import { addPMTilesProtocol } from "@/lib/pmtiles-protocol";
import { Legend } from "../Legend";
import { DomapusLogo } from "@/components/ui/domapus-logo";
import bbox from "@turf/bbox";
import { featureCollection, point } from "@turf/helpers";

const BASE_PATH = import.meta.env.BASE_URL;

// Color palette for choropleth
const CHOROPLETH_COLORS = ["#FFF9B0", "#FFEB84", "#FFD166", "#FF9A56", "#E84C61", "#C13584", "#7B2E8D", "#2E0B59"];

export interface PrintStageProps {
  filteredData: ZipData[];
  selectedMetric: string;
  regionScope: "national" | "state" | "metro";
  regionName: string;
  includeLegend: boolean;
  includeTitle: boolean;
  onReady?: () => void;
}

export interface PrintStageRef {
  getElement: () => HTMLDivElement | null;
}

function getMetricValue(data: ZipData | undefined, metric: string): number {
  if (!data) return 0;
  const value = data[metric as keyof ZipData];
  return typeof value === "number" && isFinite(value) ? value : 0;
}

function computeQuantileBuckets(values: number[], numBuckets = 8): number[] {
  const sorted = [...values].filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  
  const minVal = sorted[0];
  const maxVal = sorted[sorted.length - 1];
  if (minVal === maxVal) return [minVal];
  
  const thresholds: number[] = [];
  const epsilon = (maxVal - minVal) * 1e-6 || 1e-6;
  const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))];
  
  for (let i = 1; i < numBuckets; i++) {
    let val = q(i / numBuckets);
    if (thresholds.length && val <= thresholds[thresholds.length - 1]) {
      val = thresholds[thresholds.length - 1] + epsilon;
    }
    thresholds.push(val);
  }
  
  return thresholds;
}

const getMetricDisplayName = (metric: string): string => {
  const metricNames: Record<string, string> = { 
    "median_sale_price": "Median Sale Price",
    "median_ppsf": "Median Price per Sq Ft",
    "avg_sale_to_list_ratio": "Sale-to-List Ratio",
    "median_dom": "Median Days on Market",
  };
  return metricNames[metric] || metric.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const getCurrentDate = (): string => new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

export const PrintStage = forwardRef<PrintStageRef, PrintStageProps>(({
  filteredData,
  selectedMetric,
  regionScope,
  regionName,
  includeLegend,
  includeTitle,
  onReady
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainMapRef = useRef<HTMLDivElement>(null);
  const alaskaMapRef = useRef<HTMLDivElement>(null);
  const hawaiiMapRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<{ [key: string]: maplibregl.Map | null }>({});

  useImperativeHandle(ref, () => ({
    getElement: () => containerRef.current
  }));

  // Create lookup map
  const zipDataMap = useMemo(() => {
    const map: Record<string, ZipData> = {};
    filteredData.forEach(zip => { map[zip.zipCode] = zip; });
    return map;
  }, [filteredData]);

  // Compute buckets
  const buckets = useMemo(() => {
    const values = filteredData.map(d => getMetricValue(d, selectedMetric));
    return computeQuantileBuckets(values);
  }, [filteredData, selectedMetric]);

  // Metric values for legend
  const metricValues = useMemo(() => {
    return filteredData
      .map(d => d[selectedMetric as keyof ZipData] as number)
      .filter(v => typeof v === "number" && v > 0);
  }, [filteredData, selectedMetric]);

  // Split data for insets
  const { alaskaZips, hawaiiZips } = useMemo(() => {
    if (regionScope !== 'national') {
      return { alaskaZips: new Set<string>(), hawaiiZips: new Set<string>() };
    }
    
    const alaska = new Set<string>();
    const hawaii = new Set<string>();
    
    filteredData.forEach(zip => {
      if (zip.state === 'Alaska') alaska.add(zip.zipCode);
      else if (zip.state === 'Hawaii') hawaii.add(zip.zipCode);
    });
    
    return { alaskaZips: alaska, hawaiiZips: hawaii };
  }, [filteredData, regionScope]);

  // Calculate bounds for state/metro
  const regionBounds = useMemo(() => {
    if (regionScope === 'national') return null;
    
    const validData = filteredData.filter(d => d.latitude && d.longitude);
    if (validData.length === 0) return null;
    
    const points = validData.map(d => point([d.longitude!, d.latitude!]));
    const fc = featureCollection(points);
    const [minLng, minLat, maxLng, maxLat] = bbox(fc);
    
    return {
      bounds: [[minLng, minLat], [maxLng, maxLat]] as [[number, number], [number, number]],
      center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number]
    };
  }, [filteredData, regionScope]);

  useEffect(() => {
    addPMTilesProtocol();

    // Cleanup existing maps
    Object.keys(mapsRef.current).forEach(key => {
      mapsRef.current[key]?.remove();
      mapsRef.current[key] = null;
    });

    if (filteredData.length === 0) return;

    const pmtilesUrl = new URL(`${BASE_PATH}data/us_zip_codes.pmtiles`, window.location.origin).href;
    
    // Build step expression
    const stepExpression: ExpressionSpecification = [
      "step",
      ["coalesce", ["feature-state", "metricValue"], 0],
      "transparent",
      0.001,
      CHOROPLETH_COLORS[0],
      ...buckets.flatMap((threshold, i) => [threshold, CHOROPLETH_COLORS[Math.min(i + 1, CHOROPLETH_COLORS.length - 1)]])
    ] as ExpressionSpecification;

    const createMap = (
      container: HTMLDivElement | null, 
      key: string,
      center: [number, number],
      zoom: number,
      bounds?: [[number, number], [number, number]]
    ): maplibregl.Map | null => {
      if (!container) return null;

      const map = new maplibregl.Map({
        container,
        style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f8f9fa' } }] },
        center,
        zoom,
        interactive: false,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });

      mapsRef.current[key] = map;

      map.on('load', () => {
        // Fit to bounds if provided
        if (bounds) {
          map.fitBounds(bounds, { padding: 40, maxZoom: 10 });
        }

        map.addSource("zips", {
          type: "vector",
          url: `pmtiles://${pmtilesUrl}`,
          promoteId: "ZCTA5CE20"
        });

        map.addLayer({
          id: "zips-fill",
          type: "fill",
          source: "zips",
          "source-layer": "us_zip_codes",
          paint: {
            "fill-color": stepExpression,
            "fill-opacity": 0.85,
          }
        });

        map.addLayer({
          id: "zips-border",
          type: "line",
          source: "zips",
          "source-layer": "us_zip_codes",
          paint: {
            "line-color": "rgba(0,0,0,0.12)",
            "line-width": 0.5
          }
        });

        map.once('idle', () => {
          // Set feature states
          Object.entries(zipDataMap).forEach(([zipCode, data]) => {
            const metricValue = getMetricValue(data, selectedMetric);
            map.setFeatureState(
              { source: "zips", sourceLayer: "us_zip_codes", id: zipCode },
              { metricValue }
            );
          });
          map.triggerRepaint();
        });
      });

      return map;
    };

    let loadedCount = 0;
    const checkAllReady = () => {
      loadedCount++;
      const totalMaps = regionScope === 'national' 
        ? 1 + (alaskaZips.size > 0 ? 1 : 0) + (hawaiiZips.size > 0 ? 1 : 0)
        : 1;
      if (loadedCount >= totalMaps && onReady) {
        setTimeout(onReady, 200);
      }
    };

    // Create maps based on region
    if (regionScope === 'national') {
      // Main map for continental US
      const mainMap = createMap(mainMapRef.current, 'main', [-98.5, 39.5], 3.8);
      if (mainMap) mainMap.once('idle', checkAllReady);

      // Alaska inset
      if (alaskaZips.size > 0) {
        const akMap = createMap(alaskaMapRef.current, 'alaska', [-152, 64], 2.8);
        if (akMap) akMap.once('idle', checkAllReady);
      }

      // Hawaii inset
      if (hawaiiZips.size > 0) {
        const hiMap = createMap(hawaiiMapRef.current, 'hawaii', [-157, 21], 5.5);
        if (hiMap) hiMap.once('idle', checkAllReady);
      }
    } else {
      // Single map for state/metro
      const bounds = regionBounds?.bounds;
      const center = regionBounds?.center || [-98.5, 39.5];
      const mainMap = createMap(mainMapRef.current, 'main', center, 5, bounds);
      if (mainMap) mainMap.once('idle', checkAllReady);
    }

    return () => {
      Object.keys(mapsRef.current).forEach(key => {
        mapsRef.current[key]?.remove();
        mapsRef.current[key] = null;
      });
    };
  }, [filteredData, selectedMetric, regionScope, buckets, zipDataMap, alaskaZips, hawaiiZips, regionBounds, onReady]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-white flex flex-col"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Header - Compact with attribution on right */}
      <div className="flex items-start justify-between px-6 pt-5 pb-3">
        {includeTitle && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              {getMetricDisplayName(selectedMetric)} by ZIP Code
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {regionName} • {getCurrentDate()}
            </p>
          </div>
        )}
        <div className="text-right flex-shrink-0">
          <DomapusLogo size="sm" className="justify-end" />
          <p className="text-xs text-gray-400 mt-1">Data: Redfin</p>
        </div>
      </div>

      {/* Map Area - Takes remaining space */}
      <div className="flex-1 mx-6 mb-4 relative bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
        {filteredData.length > 0 ? (
          <>
            <div ref={mainMapRef} className="absolute inset-0" />
            
            {/* Alaska/Hawaii insets for national view */}
            {regionScope === 'national' && (
              <div className="absolute bottom-4 left-4 flex gap-2 z-10">
                {alaskaZips.size > 0 && (
                  <div className="w-40 h-28 border border-gray-300 rounded bg-white overflow-hidden shadow-sm">
                    <div ref={alaskaMapRef} className="w-full h-full" />
                  </div>
                )}
                {hawaiiZips.size > 0 && (
                  <div className="w-32 h-24 border border-gray-300 rounded bg-white overflow-hidden shadow-sm">
                    <div ref={hawaiiMapRef} className="w-full h-full" />
                  </div>
                )}
              </div>
            )}

            {/* Legend */}
            {includeLegend && (
              <div className="absolute bottom-4 right-4 w-56 z-10">
                <Legend
                  selectedMetric={selectedMetric}
                  metricValues={metricValues}
                  isExport={true}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-lg">
            No data to display
          </div>
        )}
      </div>
    </div>
  );
});

PrintStage.displayName = "PrintStage";
