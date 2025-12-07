import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMetricDisplay } from "./map/utils";
import { ZipData } from "./map/types";

const BASE_PATH = import.meta.env.BASE_URL;
(window as any).maplibregl = maplibregl;

interface MapProps {
  selectedMetric: string;
  onZipSelect: (zipData: ZipData) => void;
  searchZip?: string;
  zipData: Record<string, ZipData>;
  colorScaleDomain: [number, number] | null;
  isLoading: boolean;
  processData: (message: { type: string; data?: any }) => Promise<any>;
}

export function MapLibreMap({
  selectedMetric,
  onZipSelect,
  searchZip,
  zipData,
  isLoading,
  processData,
}: MapProps) {
  console.log('[MapLibreMap] Component render');
  
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const interactionsSetup = useRef(false);
  const [baseGeoJSON, setBaseGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const processingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
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

  // 1. Initialize Map
  const createAndInitializeMap = useCallback((container: HTMLDivElement) => {
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
      // cancel any pending RAF for mouse handlers, etc.
      if (mousemoveRafRef.current) {
        cancelAnimationFrame(mousemoveRafRef.current);
        mousemoveRafRef.current = null;
      }

      // Remove popup
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      // remove map if exists
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

  // 3. Load GeoJSON
  useEffect(() => {
    if (!isMapReady || baseGeoJSON) return;
    const controller = new AbortController();

    (async () => {
      try {
        const url = new URL(`${BASE_PATH}data/us-zip-codes.geojson`, window.location.origin).href;
        console.log("Fetching GeoJSON...", url);
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) throw new Error("Fetch failed");
        const data = await resp.json();
        setBaseGeoJSON(data);
      } catch (err: any) {
        if (err.name !== "AbortError") console.error("GeoJSON load failed", err);
      }
    })();

    return () => controller.abort();
  }, [isMapReady, baseGeoJSON]);

  // 4. Setup Interactions (Global Listeners)
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
          // Query rendered features under the cursor
          const features = map.queryRenderedFeatures(ev.point, { layers: [layerId] });
          const isHovering = features.length > 0;

          map.getCanvas().style.cursor = isHovering ? "pointer" : "";

          if (!isHovering) {
            popupRef.current?.remove();
            return;
          }

          const props = features[0].properties ?? {};
          const zipCode = props.zipCode ?? props.ZCTA5CE20 ?? props.id;
          
          const { zipData: currentZipData, selectedMetric: currentMetric } = propsRef.current;

          if (!zipCode || !currentZipData[zipCode]) {
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
      // FIX: Added ZCTA5CE20 here as well
      const zipCode = props.zipCode ?? props.zip ?? props.ZCTA5CE10 ?? props.ZCTA5CE20 ?? props.id;
      
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

  // 5. Add Source & Layer
  useEffect(() => {
    if (!isMapReady || !baseGeoJSON || !mapRef.current) return;
    const map = mapRef.current;

    if (map.getSource("zips")) return;

    try {
      const styleLayers = map.getStyle().layers; 
      styleLayers.forEach((layer) => {
        // Identify layers that use the 'transportation' source (roads, bridges, tunnels, rail)
        // We also hide 'transportation_name' to remove road labels
        if (
          layer["source-layer"] === "transportation" || 
          layer["source-layer"] === "transportation_name"
        ) {
          // Set their visibility to none
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      });

      console.log("[MapLibreMap] Adding source and layer...");
      map.addSource("zips", { type: "geojson", data: baseGeoJSON });

      const layers = map.getStyle().layers;
      let beforeId: string | undefined;
      
      // We look for watername_ocean to place zips below text labels but above the background
      const labelLayer = layers.find((l) => l.id === "watername_ocean");
      if (labelLayer) beforeId = labelLayer.id;

      map.addLayer({
        id: "zips-fill",
        type: "fill",
        source: "zips",
        paint: {
          "fill-color": [
            "case",
            ["has", "metricColor"], ["get", "metricColor"],
            "transparent"
          ],
          "fill-opacity": 0.75,
          "fill-outline-color": "rgba(0,0,0,0.08)"
        }
      }, beforeId);

      setupMapInteractions();

    } catch (err) {
      console.error("Add layer failed", err);
    }
  }, [isMapReady, baseGeoJSON, setupMapInteractions]);

  // 6. Process Data Updates
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !baseGeoJSON || Object.keys(zipData).length === 0) return;
    
    const currentDataKeys = Object.keys(zipData).sort().join(',');
    if (processingRef.current || 
       (lastProcessedMetric.current === selectedMetric && lastProcessedDataKeys.current === currentDataKeys)) {
      return;
    }

    lastProcessedMetric.current = selectedMetric;
    lastProcessedDataKeys.current = currentDataKeys;
    processingRef.current = true;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    (async () => {
      try {
        console.log("[MapLibreMap] Processing data...");
        const processed = await processData({
          type: "PROCESS_GEOJSON",
          data: { geojson: baseGeoJSON, zipData, selectedMetric },
        });

        if (abortControllerRef.current?.signal.aborted) return;

        const map = mapRef.current;
        if (map && map.getSource("zips")) {
          (map.getSource("zips") as maplibregl.GeoJSONSource).setData({
            type: "FeatureCollection",
            features: processed.features ?? [],
          });

          if (processed.bucketExpression) {
            map.setPaintProperty("zips-fill", "fill-color", processed.bucketExpression);
          }
          console.log("[MapLibreMap] Data updated on map");
        }
      } catch (err) {
        console.error("Data process failed", err);
      } finally {
        processingRef.current = false;
      }
    })();
  }, [isMapReady, baseGeoJSON, zipData, selectedMetric, processData]);

  // 7. Fly to Search
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