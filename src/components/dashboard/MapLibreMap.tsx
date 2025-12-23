import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import maplibregl, { LngLatBoundsLike } from 'maplibre-gl';
import "maplibre-gl/dist/maplibre-gl.css";
import { getMetricDisplay } from "./map/utils";
import { ZipData } from "./map/types";
import { addPMTilesProtocol } from "@/lib/pmtiles-protocol";

const BASE_PATH = import.meta.env.BASE_URL;

interface MapProps {
  selectedMetric: string;
  onZipSelect: (zipData: ZipData) => void;
  searchZip?: string;
  searchTrigger?: number; // Increment this to force a new search even with same zip
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
  searchTrigger,
  zipData,
  isLoading,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const interactionsSetup = useRef(false);
  const [pmtilesLoaded, setPmtilesLoaded] = useState(false);
  const mousemoveRafRef = useRef<number | null>(null);
  const lastMouseEventRef = useRef<any>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const lastProcessedMetric = useRef<string>("");
  const lastProcessedDataKeys = useRef<string>("");
  const highlightedZipRef = useRef<string | null>(null);
  const containerSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for current data to avoid stale closures
  const propsRef = useRef({ zipData, selectedMetric, onZipSelect });
  useEffect(() => {
    propsRef.current = { zipData, selectedMetric, onZipSelect };
  }, [zipData, selectedMetric, onZipSelect]);
  const hasData = useMemo(() => Object.keys(zipData).length > 0, [zipData]);

  // 1. Initialize Map with PMTiles (stable, only runs once)
  const createAndInitializeMap = useCallback((container: HTMLDivElement) => {
    addPMTilesProtocol();
    const bounds: LngLatBoundsLike = [[-124.7844079, 24.7433195],[-66.9513812, 49.3457868]];
    const map = new maplibregl.Map({
      container,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      minZoom: 3,
      maxZoom: 12,
      bounds: bounds,
      fitBoundsOptions: { padding: 100 },
      attributionControl: false,
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

  // 2. Setup Map Instance (stable, with debounced resize)
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
        containerSizeRef.current = { width: container.clientWidth, height: container.clientHeight };
      } catch (err) {
        console.error("Map init failed", err);
      }
    };

    // Debounced resize handler to prevent constant re-renders
    const handleResize = () => {
      if (!mapRef.current || didUnmount) return;
      
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      
      // Only resize if dimensions actually changed significantly (> 5px)
      const widthDiff = Math.abs(newWidth - containerSizeRef.current.width);
      const heightDiff = Math.abs(newHeight - containerSizeRef.current.height);
      
      if (widthDiff > 5 || heightDiff > 5) {
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        
        resizeTimeoutRef.current = setTimeout(() => {
          if (!didUnmount && mapRef.current) {
            containerSizeRef.current = { width: newWidth, height: newHeight };
            mapRef.current.resize();
          }
        }, 150); // Debounce resize by 150ms
      }
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
    tryInit();

    return () => {
      didUnmount = true;
      ro.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
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

      if (zipCode && currentZipData[zipCode]) {
        currentOnSelect(currentZipData[zipCode]);
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

  // 4. Add PMTiles Source & Layer with zoom-dependent border width
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    const map = mapRef.current;

    if (map.getSource("zips")) return;

    try {
      // Hide transportation layers for cleaner look
      const styleLayers = map.getStyle().layers;
      styleLayers.forEach((layer) => {
        if ('source-layer' in layer) {
          const sourceLayer = layer['source-layer'] as string;
          if (sourceLayer === "transportation" || sourceLayer === "transportation_name") {
            map.setLayoutProperty(layer.id, "visibility", "none");
          }
        }
      });

      const pmtilesUrl = new URL(`${BASE_PATH}data/us_zip_codes.pmtiles`, window.location.origin).href;
      
      map.addSource("zips", {
        type: "vector",
        url: `pmtiles://${pmtilesUrl}`,
        promoteId: "ZCTA5CE20"
      });

      const layers = map.getStyle().layers;
      let beforeId: string | undefined;
      const labelLayer = layers.find((l) => l.id === "watername_ocean");
      if (labelLayer) beforeId = labelLayer.id;

      // Fill layer
      map.addLayer({
        id: "zips-fill",
        type: "fill",
        source: "zips",
        "source-layer": "us_zip_codes",
        paint: {
          "fill-color": "#cccccc",
          "fill-opacity": 0.75,
        }
      }, beforeId);

      // Border layer with zoom-dependent width
      map.addLayer({
        id: "zips-border",
        type: "line",
        source: "zips",
        "source-layer": "us_zip_codes",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "highlighted"], false],
            "#ff6b35", // Highlight color for searched ZIP
            "rgba(0,0,0,0.15)"
          ],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            3, ["case", ["boolean", ["feature-state", "highlighted"], false], 2, 0.3],
            6, ["case", ["boolean", ["feature-state", "highlighted"], false], 3, 0.6],
            10, ["case", ["boolean", ["feature-state", "highlighted"], false], 4, 1.5],
            12, ["case", ["boolean", ["feature-state", "highlighted"], false], 5, 2]
          ]
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
    if (!isMapReady || !mapRef.current || !pmtilesLoaded || !hasData) return;
    const map = mapRef.current;
    const src = map.getSource("zips") as any;
    if (!src || !src._loaded) return;
    if (!map.getLayer("zips-fill")) return;
      
    const currentDataKeys = Object.keys(zipData).length.toString();
    if (lastProcessedMetric.current === selectedMetric && lastProcessedDataKeys.current === currentDataKeys) {
      return;
    }

    lastProcessedMetric.current = selectedMetric;
    lastProcessedDataKeys.current = currentDataKeys;

    console.log("[MapLibreMap] Updating choropleth colors...");
    
    const values = Object.values(zipData).map(d => getMetricValue(d, selectedMetric));
    const buckets = computeQuantileBuckets(values);
    
    if (buckets.length === 0) {
      console.warn("[MapLibreMap] No valid data for choropleth");
      return;
    }

    const stepExpression: any[] = [
      "step",
      ["coalesce", ["feature-state", "metricValue"], 0],
      "transparent",
      0.001,
      CHOROPLETH_COLORS[0],
      ...buckets.flatMap((threshold, i) => [threshold, CHOROPLETH_COLORS[Math.min(i + 1, CHOROPLETH_COLORS.length - 1)]])
    ];

    for (const [zipCode, data] of Object.entries(zipData)) {
      const metricValue = getMetricValue(data, selectedMetric);
      map.setFeatureState(
        { source: "zips", sourceLayer: "us_zip_codes", id: zipCode },
        { metricValue }
      );
    }

    map.setPaintProperty("zips-fill", "fill-color", stepExpression);
    
    console.log(`[MapLibreMap] Choropleth updated for ${Object.keys(zipData).length} ZIPs`);
  }, [isMapReady, pmtilesLoaded, zipData, selectedMetric, hasData]);

  // 6. Fly to Search and Highlight ZIP - ALWAYS responsive to searchTrigger
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !pmtilesLoaded) return;
    if (!searchZip || !zipData[searchZip]) return;
    
    const map = mapRef.current;
    const { longitude, latitude } = zipData[searchZip];
    
    // Clear previous highlight
    if (highlightedZipRef.current && highlightedZipRef.current !== searchZip) {
      map.setFeatureState(
        { source: "zips", sourceLayer: "us_zip_codes", id: highlightedZipRef.current },
        { highlighted: false }
      );
    }
    
    // Set new highlight
    map.setFeatureState(
      { source: "zips", sourceLayer: "us_zip_codes", id: searchZip },
      { highlighted: true }
    );
    highlightedZipRef.current = searchZip;
    
    // Always fly to the location when searchTrigger changes
    if (longitude && latitude) {
      map.flyTo({ center: [longitude, latitude], zoom: 10, duration: 1500 });
    }
  }, [isMapReady, pmtilesLoaded, searchZip, searchTrigger, zipData]);

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
