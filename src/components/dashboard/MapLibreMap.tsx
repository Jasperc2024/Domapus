import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMetricDisplay } from "./map/utils";
import { ZipData } from "./map/types";
import { addPMTilesProtocol } from "@/lib/pmtiles-protocol";

const BASE_PATH = import.meta.env.BASE_URL;

interface MapProps {
  selectedMetric: string;
  onZipSelect: (zipData: ZipData) => void;
  searchZip?: string;
  zipData: Record<string, ZipData>;
  colorScaleDomain: [number, number] | null;
  isLoading: boolean;
  processData: (message: { type: string; data?: any }) => Promise<any>;
}

// Color palette for choropleth (light yellow to deep purple)
const CHOROPLETH_COLORS = ["#FFF9B0", "#FFEB84", "#FFD166", "#FF9A56", "#E84C61", "#C13584", "#7B2E8D", "#2E0B59"];

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

export function MapLibreMap({
  selectedMetric,
  onZipSelect,
  searchZip,
  zipData,
  isLoading,
}: MapProps) {
  console.log('[MapLibreMap] Component render');
  
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const interactionsSetup = useRef(false);
  const [pmtilesLoaded, setPmtilesLoaded] = useState(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mousemoveRafRef = useRef<number | null>(null);
  const lastMouseEventRef = useRef<any>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const lastProcessedMetric = useRef<string>("");
  const lastProcessedDataKeys = useRef<string>("");

  // Refs for current data to avoid stale closures
  const propsRef = useRef({ zipData, selectedMetric, onZipSelect });
  useEffect(() => {
    propsRef.current = { zipData, selectedMetric, onZipSelect };
  }, [zipData, selectedMetric, onZipSelect]);

  // 1. Initialize Map with PMTiles
  const createAndInitializeMap = useCallback((container: HTMLDivElement) => {
    // Register PMTiles protocol
    addPMTilesProtocol();
    
    const map = new maplibregl.Map({
      container,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [-98.57, 39.82],
      zoom: 3.5,
      minZoom: 3,
      maxZoom: 12,
      attributionControl: false
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("error", (e) => {
      console.error("[Map] Internal error:", (e as any)?.error ?? e);
      setError("Map internal error. Try refreshing.");
    });

    map.once("load", () => {
      console.log("[Map] style/load fired — map is ready");
      setIsMapReady(true);
    });

    return map;
  }, []);

  // 2. Setup Map Instance
  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    const container = mapContainer.current;
    let didUnmount = false;

    const tryInit = () => {
      if (didUnmount) return;
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      
      try {
        const m = createAndInitializeMap(container);
        mapRef.current = m;
      } catch (err) {
        console.error("Map init failed", err);
      }
    };

    const ro = new ResizeObserver(() => {
      tryInit();
      mapRef.current?.resize();
    });
    resizeObserverRef.current = ro;
    ro.observe(container);
    tryInit();

    return () => {
      didUnmount = true;
      ro.disconnect();
      resizeObserverRef.current = null;
      if (mousemoveRafRef.current) {
        cancelAnimationFrame(mousemoveRafRef.current);
        mousemoveRafRef.current = null;
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (mapRef.current) {
        try {
          console.log('[MapLibreMap] Removing map instance');
          mapRef.current.remove();
        } catch (err) {
          console.warn("[MapLibreMap] error removing map", err);
        }
        mapRef.current = null;
      }
      setIsMapReady(false);
      interactionsSetup.current = false;
    };
  }, [createAndInitializeMap]);

  // 3. Setup Interactions (Global Listeners)
  const setupMapInteractions = useCallback(() => {
    const map = mapRef.current;
    if (!map || interactionsSetup.current) return;

    const layerId = "zips-fill";
    console.log(`[MapLibreMap] Setting up interactions for layer: ${layerId}`);

    const mousemoveHandler = (e: any) => {
      lastMouseEventRef.current = e;
      if (mousemoveRafRef.current) return;

      mousemoveRafRef.current = requestAnimationFrame(() => {
        const ev = lastMouseEventRef.current;
        mousemoveRafRef.current = null;
        
        try {
          const features = map.queryRenderedFeatures(ev.point, { layers: [layerId] });
          const isHovering = features.length > 0;

          map.getCanvas().style.cursor = isHovering ? "pointer" : "";

          if (!isHovering) {
            popupRef.current?.remove();
            return;
          }

          const props = features[0].properties ?? {};
          // PMTiles uses ZCTA5CE20 as the zip code attribute
          const zipCode = props.ZCTA5CE20 || props.zipCode || props.id;
          
          const { zipData: currentZipData, selectedMetric: currentMetric } = propsRef.current;

          if (!zipCode || !currentZipData[zipCode]) {
            popupRef.current?.remove();
            return;
          }

          if (!popupRef.current) {
            popupRef.current = new maplibregl.Popup({ 
              closeButton: false, offset: [0, -10], maxWidth: "320px" 
            });
          }
          
          popupRef.current
            .setLngLat(ev.lngLat)
            .setHTML(getMetricDisplay(currentZipData[zipCode], currentMetric))
            .addTo(map);

        } catch (err) {
          console.error("mousemove error", err);
        }
      });
    };

    const clickHandler = (e: any) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
      
      if (!features.length) return;

      const props = features[0].properties ?? {};
      const zipCode = props.ZCTA5CE20 || props.zipCode || props.id;
      
      const { zipData: currentZipData, onZipSelect: currentOnSelect } = propsRef.current;

      console.log(`[MapLibreMap] Clicked ZIP: ${zipCode}`);

      if (zipCode && currentZipData[zipCode]) {
        currentOnSelect(currentZipData[zipCode]);
      } else {
        console.warn(`[MapLibreMap] ZIP ${zipCode} found on map but missing in zipData`);
      }
    };

    const mouseoutHandler = () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
    };

    map.on("mousemove", mousemoveHandler);
    map.on("click", clickHandler);
    map.on("mouseout", mouseoutHandler);

    interactionsSetup.current = true;
  }, []);

  // 4. Add PMTiles Source & Layer
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    const map = mapRef.current;

    if (map.getSource("zips")) return;

    try {
      // Hide transportation layers for cleaner look
      const styleLayers = map.getStyle().layers;
      styleLayers.forEach((layer) => {
        // Type guard for layers with source-layer property
        if ('source-layer' in layer) {
          const sourceLayer = layer['source-layer'] as string;
          if (sourceLayer === "transportation" || sourceLayer === "transportation_name") {
            map.setLayoutProperty(layer.id, "visibility", "none");
          }
        }
      });

      console.log("[MapLibreMap] Adding PMTiles source...");
      const pmtilesUrl = new URL(`${BASE_PATH}data/us_zip_codes.pmtiles`, window.location.origin).href;
      
      map.addSource("zips", {
        type: "vector",
        url: `pmtiles://${pmtilesUrl}`,
      });

      const layers = map.getStyle().layers;
      let beforeId: string | undefined;
      const labelLayer = layers.find((l) => l.id === "watername_ocean");
      if (labelLayer) beforeId = labelLayer.id;

      map.addLayer({
        id: "zips-fill",
        type: "fill",
        source: "zips",
        "source-layer": "us_zip_codes", // PMTiles layer name
        paint: {
          "fill-color": "#cccccc", // Default gray, will be updated with choropleth
          "fill-opacity": 0.75,
          "fill-outline-color": "rgba(0,0,0,0.08)"
        }
      }, beforeId);

      map.once("idle", () => {
        console.log("[MapLibreMap] PMTiles layer loaded");
        setPmtilesLoaded(true);
      });

      setupMapInteractions();

    } catch (err) {
      console.error("Add PMTiles layer failed", err);
      setError("Failed to load map data. Try refreshing.");
    }
  }, [isMapReady, setupMapInteractions]);

  // 5. Update Choropleth Colors using setFeatureState
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !pmtilesLoaded || Object.keys(zipData).length === 0) return;
    
    const currentDataKeys = Object.keys(zipData).length.toString();
    if (lastProcessedMetric.current === selectedMetric && lastProcessedDataKeys.current === currentDataKeys) {
      return;
    }

    lastProcessedMetric.current = selectedMetric;
    lastProcessedDataKeys.current = currentDataKeys;

    const map = mapRef.current;

    console.log("[MapLibreMap] Updating choropleth colors...");
    
    // Compute quantile buckets from current data
    const values = Object.values(zipData).map(d => getMetricValue(d, selectedMetric));
    const buckets = computeQuantileBuckets(values);
    
    if (buckets.length === 0) {
      console.warn("[MapLibreMap] No valid data for choropleth");
      return;
    }

    // Build step expression for choropleth coloring
    // Use feature-state for dynamic coloring based on zipData
    const stepExpression: any[] = [
      "step",
      ["coalesce", ["feature-state", "metricValue"], 0],
      "transparent", // Default for no data
      0.001, // Threshold for "has data"
      CHOROPLETH_COLORS[0],
      ...buckets.flatMap((threshold, i) => [threshold, CHOROPLETH_COLORS[Math.min(i + 1, CHOROPLETH_COLORS.length - 1)]])
    ];

    // Set feature states for each ZIP code
    for (const [zipCode, data] of Object.entries(zipData)) {
      const metricValue = getMetricValue(data, selectedMetric);
      map.setFeatureState(
        { source: "zips", sourceLayer: "us_zip_codes", id: zipCode },
        { metricValue }
      );
    }

    // Update paint property with step expression
    map.setPaintProperty("zips-fill", "fill-color", stepExpression);
    
    console.log(`[MapLibreMap] Choropleth updated for ${Object.keys(zipData).length} ZIPs, ${buckets.length} buckets`);
  }, [isMapReady, pmtilesLoaded, zipData, selectedMetric]);

  // 6. Fly to Search
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !searchZip || !zipData[searchZip]) return;
    const { longitude, latitude } = zipData[searchZip];
    if (longitude && latitude) {
      mapRef.current.flyTo({ center: [longitude, latitude], zoom: 10 });
    }
  }, [isMapReady, searchZip, zipData]);

  return (
    <div className="absolute inset-0 w-full h-full min-h-[400px]">
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: "400px" }} />
      {(isLoading || !isMapReady || error) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
          {error ? <div className="text-red-500 font-bold">{error}</div> : <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />}
        </div>
      )}
    </div>
  );
}
