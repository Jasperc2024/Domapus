// Export Preview Map component using PMTiles
import { useEffect, useRef, useMemo } from "react";
import maplibregl, { ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ZipData } from "./map/types";
import { addPMTilesProtocol } from "@/lib/pmtiles-protocol";

const BASE_PATH = import.meta.env.BASE_URL;

// Color palette for choropleth
const CHOROPLETH_COLORS = ["#FFF9B0", "#FFEB84", "#FFD166", "#FF9A56", "#E84C61", "#C13584", "#7B2E8D", "#2E0B59"];

interface ExportPreviewMapProps {
  filteredData: ZipData[];
  selectedMetric: string;
  regionScope: "national" | "state" | "metro";
  onRenderComplete?: () => void;
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

export function ExportPreviewMap({ filteredData, selectedMetric, regionScope, onRenderComplete }: ExportPreviewMapProps) {
  const mainMapRef = useRef<HTMLDivElement>(null);
  const alaskaMapRef = useRef<HTMLDivElement>(null);
  const hawaiiMapRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<{ [key: string]: maplibregl.Map | null }>({});

  // Create a lookup map from filtered data
  const zipDataMap = useMemo(() => {
    const map: Record<string, ZipData> = {};
    filteredData.forEach(zip => {
      map[zip.zipCode] = zip;
    });
    return map;
  }, [filteredData]);

  // Compute color buckets
  const buckets = useMemo(() => {
    const values = filteredData.map(d => getMetricValue(d, selectedMetric));
    return computeQuantileBuckets(values);
  }, [filteredData, selectedMetric]);

  // Determine map bounds based on region
  const { center, zoom } = useMemo(() => {
    if (regionScope === 'national') {
      return { center: [-98.5, 39.8] as [number, number], zoom: 3.5 };
    }
    
    // Calculate bounds from filtered data
    const validData = filteredData.filter(d => d.latitude && d.longitude);
    if (validData.length === 0) {
      return { center: [-98.5, 39.8] as [number, number], zoom: 3.5 };
    }
    
    const lngs = validData.map(d => d.longitude!);
    const lats = validData.map(d => d.latitude!);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;
    
    // Estimate zoom level based on extent
    const extent = Math.max(maxLng - minLng, maxLat - minLat);
    let zoomLevel = 4;
    if (extent < 2) zoomLevel = 8;
    else if (extent < 5) zoomLevel = 6;
    else if (extent < 10) zoomLevel = 5;
    
    return { center: [centerLng, centerLat] as [number, number], zoom: zoomLevel };
  }, [filteredData, regionScope]);

  // Split data for insets (Alaska/Hawaii)
  const { alaskaZips, hawaiiZips } = useMemo(() => {
    if (regionScope !== 'national') return { alaskaZips: new Set<string>(), hawaiiZips: new Set<string>() };
    
    const alaska = new Set<string>();
    const hawaii = new Set<string>();
    
    filteredData.forEach(zip => {
      if (zip.state === 'Alaska') alaska.add(zip.zipCode);
      else if (zip.state === 'Hawaii') hawaii.add(zip.zipCode);
    });
    
    return { alaskaZips: alaska, hawaiiZips: hawaii };
  }, [filteredData, regionScope]);

  useEffect(() => {
    // Register PMTiles protocol
    addPMTilesProtocol();

    // Cleanup existing maps
    Object.keys(mapsRef.current).forEach(key => {
      if (mapsRef.current[key]) {
        mapsRef.current[key]!.remove();
        mapsRef.current[key] = null;
      }
    });

    const pmtilesUrl = new URL(`${BASE_PATH}data/us_zip_codes.pmtiles`, window.location.origin).href;
    
    interface MapConfig {
      key: string;
      ref: React.RefObject<HTMLDivElement>;
      center: [number, number];
      zoom: number;
      filterSet?: Set<string>;
    }

    const mapConfigs: MapConfig[] = [
      { key: 'main', ref: mainMapRef, center, zoom },
      ...(regionScope === 'national' && alaskaZips.size > 0 ? [
        { key: 'alaska', ref: alaskaMapRef, center: [-152, 64] as [number, number], zoom: 2.5, filterSet: alaskaZips }
      ] : []),
      ...(regionScope === 'national' && hawaiiZips.size > 0 ? [
        { key: 'hawaii', ref: hawaiiMapRef, center: [-157, 21] as [number, number], zoom: 5, filterSet: hawaiiZips }
      ] : [])
    ];

    let loadedCount = 0;
    const totalMaps = mapConfigs.filter(c => c.ref.current).length;

    const onMapIdle = () => {
      loadedCount++;
      if (loadedCount === totalMaps && onRenderComplete) {
        onRenderComplete();
      }
    };

    mapConfigs.forEach(({ key, ref, center: mapCenter, zoom: mapZoom }) => {
      if (!ref.current) return;

      const map = new maplibregl.Map({
        container: ref.current,
        style: { 
          version: 8, 
          sources: {}, 
          layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f8f9fa' } }] 
        },
        center: mapCenter,
        zoom: mapZoom,
        interactive: false,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });

      mapsRef.current[key] = map;

      map.on('load', () => {
        // Add PMTiles source with promoteId for feature state
        map.addSource("zips", {
          type: "vector",
          url: `pmtiles://${pmtilesUrl}`,
          promoteId: "ZCTA5CE20"
        });

        // Build step expression for choropleth
        const stepExpression: ExpressionSpecification = [
          "step",
          ["coalesce", ["feature-state", "metricValue"], 0],
          "transparent",
          0.001,
          CHOROPLETH_COLORS[0],
          ...buckets.flatMap((threshold, i) => [threshold, CHOROPLETH_COLORS[Math.min(i + 1, CHOROPLETH_COLORS.length - 1)]])
        ] as ExpressionSpecification;

        map.addLayer({
          id: "zips-fill",
          type: "fill",
          source: "zips",
          "source-layer": "us_zip_codes",
          paint: {
            "fill-color": stepExpression,
            "fill-opacity": 0.8,
            "fill-outline-color": "rgba(0,0,0,0.1)"
          }
        });

        // Set feature states for choropleth coloring
        // Use a small delay to ensure tiles are loaded
        map.once('idle', () => {
          Object.entries(zipDataMap).forEach(([zipCode, data]) => {
            const metricValue = getMetricValue(data, selectedMetric);
            map.setFeatureState(
              { source: "zips", sourceLayer: "us_zip_codes", id: zipCode },
              { metricValue }
            );
          });
          
          // Trigger repaint
          map.triggerRepaint();
          
          // Wait for repaint then call complete
          setTimeout(onMapIdle, 100);
        });
      });
    });

    return () => {
      Object.keys(mapsRef.current).forEach(key => {
        if (mapsRef.current[key]) {
          mapsRef.current[key]!.remove();
          mapsRef.current[key] = null;
        }
      });
    };
  }, [center, zoom, regionScope, alaskaZips, hawaiiZips, buckets, zipDataMap, selectedMetric, onRenderComplete]);

  return (
    <div className="relative w-full h-full bg-gray-50">
      <div ref={mainMapRef} className="w-full h-full" />
      
      {regionScope === 'national' && (
        <div className="absolute bottom-6 left-6 flex gap-3">
          {alaskaZips.size > 0 && (
            <div className="w-44 h-36 border-2 border-gray-400 rounded shadow-lg bg-white overflow-hidden">
              <div ref={alaskaMapRef} className="w-full h-full" />
            </div>
          )}
          {hawaiiZips.size > 0 && (
            <div className="w-36 h-28 border-2 border-gray-400 rounded shadow-lg bg-white overflow-hidden">
              <div ref={hawaiiMapRef} className="w-full h-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
