import { useEffect, useRef, useMemo, forwardRef, useImperativeHandle, useState } from "react";
import maplibregl, { ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ZipData } from "../map/types";
import { addPMTilesProtocol } from "@/lib/pmtiles-protocol";
import bbox from "@turf/bbox";
import { featureCollection, point } from "@turf/helpers";

const BASE_PATH = import.meta.env.BASE_URL;

// Color palette for choropleth (must match main map)
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
    "zhvi": "Zillow Home Value Index",
    "median_sale_price": "Median Sale Price",
    "median_ppsf": "Median Price per Sq Ft",
    "avg_sale_to_list_ratio": "Sale-to-List Ratio",
    "median_dom": "Median Days on Market",
  };
  return metricNames[metric] || metric.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const getDate = (): string =>
  new Date(new Date().setMonth(new Date().getMonth() - 1))
    .toLocaleDateString("en-US", { month: "long", year: "numeric" });

// Format legend value
function formatLegendValue(value: number, metric: string): string {
  const m = metric.toLowerCase();
  if (m.includes("price") || m.includes("zhvi")) return `$${(value / 1000).toFixed(0)}k`;
  if (m.includes("ratio")) return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}

function computeQuantiles(values: number[], percentiles: number[]) {
  if (!values || values.length === 0) return percentiles.map(() => 0);
  const sorted = [...values].sort((a, b) => a - b);
  return percentiles.map((p) => {
    const idx = (sorted.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  });
}

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
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Stable key to prevent unnecessary map recreation
  const stableKey = useMemo(() => {
    return `${regionScope}-${regionName}-${selectedMetric}-${filteredData.length}`;
  }, [regionScope, regionName, selectedMetric, filteredData.length]);

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

  // Legend display values
  const legendDisplay = useMemo(() => {
    if (metricValues.length === 0) return { min: "N/A", mid: "N/A", max: "N/A" };
    const [min, mid, max] = computeQuantiles(metricValues, [0.05, 0.5, 0.95]);
    return {
      min: formatLegendValue(min, selectedMetric),
      mid: formatLegendValue(mid, selectedMetric),
      max: formatLegendValue(max, selectedMetric),
    };
  }, [metricValues, selectedMetric]);

  // Set of valid ZIP codes in this region
  const validZipSet = useMemo(() => new Set(filteredData.map(z => z.zipCode)), [filteredData]);

  // Split data for insets (Alaska/Hawaii)
  const { alaskaZips, hawaiiZips, mainlandZips } = useMemo(() => {
    if (regionScope !== 'national') {
      return { alaskaZips: new Set<string>(), hawaiiZips: new Set<string>(), mainlandZips: validZipSet };
    }
    
    const alaska = new Set<string>();
    const hawaii = new Set<string>();
    const mainland = new Set<string>();
    
    filteredData.forEach(zip => {
      const st = (zip.state ?? '').toString();
      if (st === 'AK' || st.toLowerCase() === 'alaska') alaska.add(zip.zipCode);
      else if (st === 'HI' || st.toLowerCase() === 'hawaii') hawaii.add(zip.zipCode);
      else mainland.add(zip.zipCode);
    });
    
    return { alaskaZips: alaska, hawaiiZips: hawaii, mainlandZips: mainland };
  }, [filteredData, regionScope, validZipSet]);

  // Calculate bounds for state/metro with padding
  const regionBounds = useMemo(() => {
    if (regionScope === 'national') return null;
    
    const validData = filteredData.filter(d => d.latitude && d.longitude);
    if (validData.length === 0) return null;
    
    const points = validData.map(d => point([d.longitude!, d.latitude!]));
    const fc = featureCollection(points);
    let [minLng, minLat, maxLng, maxLat] = bbox(fc);
    
    // Add 10% padding to ensure no cropping
    const lngPad = (maxLng - minLng) * 0.1 || 0.5;
    const latPad = (maxLat - minLat) * 0.1 || 0.5;
    minLng -= lngPad;
    maxLng += lngPad;
    minLat -= latPad;
    maxLat += latPad;
    
    return {
      bounds: [[minLng, minLat], [maxLng, maxLat]] as [[number, number], [number, number]],
      center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number]
    };
  }, [filteredData, regionScope]);

  // Calculate national bounds (excluding AK/HI) to prevent cropping
  const nationalBounds = useMemo(() => {
    if (regionScope !== 'national') return null;
    
    const mainlandData = filteredData.filter(d => {
      const st = (d.state ?? '').toString();
      const isAkHi = st === 'AK' || st === 'HI' || st.toLowerCase() === 'alaska' || st.toLowerCase() === 'hawaii';
      return !isAkHi && d.latitude && d.longitude;
    });
    
    if (mainlandData.length === 0) return null;
    
    const points = mainlandData.map(d => point([d.longitude!, d.latitude!]));
    const fc = featureCollection(points);
    let [minLng, minLat, maxLng, maxLat] = bbox(fc);
    
    // Add padding
    const lngPad = (maxLng - minLng) * 0.05 || 0.5;
    const latPad = (maxLat - minLat) * 0.05 || 0.5;
    
    return [[minLng - lngPad, minLat - latPad], [maxLng + lngPad, maxLat + latPad]] as [[number, number], [number, number]];
  }, [filteredData, regionScope]);

  useEffect(() => {
    addPMTilesProtocol();
    setMapsLoaded(false);

    // Cleanup existing maps
    Object.keys(mapsRef.current).forEach(key => {
      mapsRef.current[key]?.remove();
      mapsRef.current[key] = null;
    });

    if (filteredData.length === 0) {
      if (onReady) onReady();
      return;
    }

    const pmtilesUrl = new URL(`${BASE_PATH}data/us_zip_codes.pmtiles`, window.location.origin).href;
    
    // Build step expression for choropleth
    const stepExpression: ExpressionSpecification = [
      "step",
      ["coalesce", ["feature-state", "metricValue"], 0],
      "transparent",
      0.001,
      CHOROPLETH_COLORS[0],
      ...buckets.flatMap((threshold, i) => [threshold, CHOROPLETH_COLORS[Math.min(i + 1, CHOROPLETH_COLORS.length - 1)]])
    ] as ExpressionSpecification;

    // Track loading state
    let loadedCount = 0;
    const requiredMaps = regionScope === 'national' 
      ? 1 + (alaskaZips.size > 0 ? 1 : 0) + (hawaiiZips.size > 0 ? 1 : 0)
      : 1;

    const checkAllReady = () => {
      loadedCount++;
      if (loadedCount >= requiredMaps) {
        setMapsLoaded(true);
        if (onReady) onReady();
      }
    };

    const createMap = (
      container: HTMLDivElement | null, 
      key: string,
      center: [number, number],
      zoom: number,
      bounds?: [[number, number], [number, number]],
      validZips?: Set<string>
    ): maplibregl.Map | null => {
      if (!container) return null;

      const map = new maplibregl.Map({
        container,
        style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ffffff' } }] },
        center,
        zoom,
        interactive: false,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });

      mapsRef.current[key] = map;

      map.on('load', () => {
        if (bounds) {
          map.fitBounds(bounds, { padding: 30, maxZoom: 10 });
        }

        map.addSource("zips", {
          type: "vector",
          url: `pmtiles://${pmtilesUrl}`,
          promoteId: "ZCTA5CE20"
        });

        // Fill layer - only show colored zips in this region
        map.addLayer({
          id: "zips-fill",
          type: "fill",
          source: "zips",
          "source-layer": "us_zip_codes",
          paint: {
            "fill-color": stepExpression,
            "fill-opacity": 0.9,
          }
        });

        // Border layer - only show borders for zips in this region
        map.addLayer({
          id: "zips-border",
          type: "line",
          source: "zips",
          "source-layer": "us_zip_codes",
          paint: {
            "line-color": [
              "case",
              ["boolean", ["feature-state", "inRegion"], false],
              "rgba(0,0,0,0.2)",
              "transparent"
            ],
            "line-width": 0.5
          }
        });

        map.once('idle', () => {
          // Set feature states for coloring and border visibility
          const zipsToColor = validZips || validZipSet;
          
          zipsToColor.forEach(zipCode => {
            const data = zipDataMap[zipCode];
            if (data) {
              const metricValue = getMetricValue(data, selectedMetric);
              map.setFeatureState(
                { source: "zips", sourceLayer: "us_zip_codes", id: zipCode },
                { metricValue, inRegion: true }
              );
            }
          });
          
          map.triggerRepaint();
          
          // Wait for final idle after repaint
          map.once('idle', checkAllReady);
        });
      });

      return map;
    };

    // Create maps based on region
    if (regionScope === 'national') {
      // Use calculated bounds for mainland to prevent cropping
      createMap(mainMapRef.current, 'main', [-98.5, 39.5], 3.8, nationalBounds || undefined, mainlandZips);
      if (alaskaZips.size > 0) createMap(alaskaMapRef.current, 'alaska', [-152, 64], 2.8, undefined, alaskaZips);
      if (hawaiiZips.size > 0) createMap(hawaiiMapRef.current, 'hawaii', [-157, 20.5], 5.5, undefined, hawaiiZips);
    } else {
      const bounds = regionBounds?.bounds;
      const center = regionBounds?.center || [-98.5, 39.5];
      createMap(mainMapRef.current, 'main', center, 5, bounds, validZipSet);
    }

    return () => {
      Object.keys(mapsRef.current).forEach(key => {
        mapsRef.current[key]?.remove();
        mapsRef.current[key] = null;
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex flex-col"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#ffffff' }}
    >
      {/* Header - Compact with attribution on right */}
      <div className="flex items-start justify-between px-6 pt-5 pb-3" style={{ backgroundColor: '#ffffff' }}>
        {includeTitle && (
          <div>
            <h1 className="text-2xl font-bold leading-tight" style={{ color: '#111827' }}>
              {getMetricDisplayName(selectedMetric)} by ZIP Code
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
              {regionName} • {getDate()}
            </p>
          </div>
        )}
        <div className="text-right flex-shrink-0">
          <a 
            href="https://domapus.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-base font-bold"
            style={{ color: '#2563eb', textDecoration: 'none' }}
          >
            Domapus
          </a>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
            Data: <a 
              href="https://www.redfin.com/news/data-center/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#2563eb', textDecoration: 'none' }}
            >Redfin</a>
          </p>
        </div>
      </div>

      {/* Map Area - Takes remaining space */}
      <div className="flex-1 mx-6 mb-4 relative overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
        {filteredData.length > 0 ? (
          <>
            <div ref={mainMapRef} className="absolute inset-0" />
            
            {/* Alaska/Hawaii insets for national view */}
            {regionScope === 'national' && (
              <div className="absolute bottom-4 left-4 flex gap-3 z-10">
                {alaskaZips.size > 0 && (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium mb-1" style={{ color: '#6b7280' }}>Alaska</span>
                    <div className="w-36 h-24 border overflow-hidden" style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff' }}>
                      <div ref={alaskaMapRef} className="w-full h-full" />
                    </div>
                  </div>
                )}
                {hawaiiZips.size > 0 && (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium mb-1" style={{ color: '#6b7280' }}>Hawaii</span>
                    <div className="w-28 h-20 border overflow-hidden" style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff' }}>
                      <div ref={hawaiiMapRef} className="w-full h-full" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Legend - no border, just elements */}
            {includeLegend && (
              <div className="absolute bottom-4 right-4 z-10 p-3" style={{ backgroundColor: '#ffffff' }}>
                <div className="text-xs font-semibold mb-2" style={{ color: '#111827' }}>
                  {getMetricDisplayName(selectedMetric)}
                </div>
                <div
                  className="h-3 w-48"
                  style={{ 
                    background: `linear-gradient(to right, ${CHOROPLETH_COLORS.join(', ')})`,
                    borderRadius: '2px'
                  }}
                />
                <div className="mt-1 flex justify-between text-[10px] font-medium w-48" style={{ color: '#6b7280' }}>
                  <span>{legendDisplay.min}</span>
                  <span>{legendDisplay.mid}</span>
                  <span>{legendDisplay.max}</span>
                </div>
              </div>
            )}

            {/* Loading overlay */}
            {!mapsLoaded && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#2563eb' }} />
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-lg" style={{ color: '#9ca3af' }}>
            No data to display
          </div>
        )}
      </div>
    </div>
  );
});

PrintStage.displayName = "PrintStage";
