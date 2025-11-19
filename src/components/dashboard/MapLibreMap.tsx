import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { LngLatLike } from "maplibre-gl";
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
  progress: { phase: string };
  processData: (message: { type: string; data?: any }) => Promise<any>;
}

export function MapLibreMap({
  selectedMetric,
  onZipSelect,
  searchZip,
  zipData,
  isLoading,
  progress,
  processData,
}: MapProps) {
  console.log('[MapLibreMap] Component render, selectedMetric:', selectedMetric);
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

  // create map factory
  const createAndInitializeMap = useCallback((container: HTMLDivElement) => {
    const map = new maplibregl.Map({
      container,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [-98.57, 39.82],
      zoom: 3.5,
      minZoom: 3,
      maxZoom: 12,
    });

    // catch map internal errors
    map.on("error", (e) => {
      console.error("[Map] Internal error:", (e as any)?.error ?? e);
      setError("Map encountered an internal error. Try refreshing.");
    });

    // the 'load' event is the reliable moment the style is fully available
    map.once("load", () => {
      console.log("[Map] style/load fired — map is ready");
      setIsMapReady(true);
    });

    // Navigation controls
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    return map;
  }, []);

  // Initialize map (with ResizeObserver and safe sizing)
  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return; // already created

    const container = mapContainer.current;
    let didUnmount = false;

    // ensure container has non-zero size, otherwise wait for ResizeObserver
    const tryInit = () => {
      if (didUnmount) return;
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) {
        console.log("[MapLibreMap] container size is zero, waiting for resize...");
        return;
      }
      try {
        console.log("[MapLibreMap] Initializing map instance...");
        const m = createAndInitializeMap(container);
        mapRef.current = m;
      } catch (err) {
        console.error("[MapLibreMap] create map failed:", err);
        setError("Failed to initialize map.");
      }
    };

    // Observe size changes
    const ro = new ResizeObserver(() => {
      tryInit();
      if (mapRef.current) {
        // schedule a resize to keep map synced to container
        mapRef.current.resize();
      }
    });
    resizeObserverRef.current = ro;
    ro.observe(container);

    // try once immediately
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

      // remove map if exists
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (err) {
          console.warn("[MapLibreMap] error removing map", err);
        }
        mapRef.current = null;
      }
      setIsMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createAndInitializeMap]);

  // Load base GeoJSON (safe fetch + decompress with pako)
  useEffect(() => {
    if (!isMapReady || baseGeoJSON) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    (async () => {
      try {
      console.log("[MapLibreMap] Starting GeoJSON fetch");
      const geoJsonUrl = new URL(
        `${BASE_PATH}data/us-zip-codes.geojson`,
        window.location.origin
      ).href;

      console.log("[MapLibreMap] fetching base geojson...", geoJsonUrl);

      const resp = await fetch(geoJsonUrl, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }

      const parsed = await resp.json();

      if (!parsed || parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
        throw new Error("Invalid GeoJSON structure");
      }

      if (!cancelled) {
        console.log(`[MapLibreMap] GeoJSON loaded: ${parsed.features.length} features`);
        setBaseGeoJSON(parsed);
      }
      } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        console.warn("[MapLibreMap] geojson fetch aborted/timed out");
        setError("Map data load timed out. Try refreshing.");
      } else {
        console.error("[MapLibreMap] geojson load failed", err);
        setError("Failed to load map data.");
      }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [isMapReady, baseGeoJSON]);

  // Add source + layer when both map & baseGeoJSON are ready
  useEffect(() => {
    if (!isMapReady || !baseGeoJSON || !mapRef.current) return;

    const map = mapRef.current;
    // only add once and only when style is loaded
    if (!map.isStyleLoaded()) {
      console.log("[MapLibreMap] style not loaded yet, will add source later");
      return;
    }

    if (map.getSource("zips")) {
      // already added
      return;
    }

    try {
      map.addSource("zips", { type: "geojson", data: baseGeoJSON });

      // insert before first label symbol layer if possible
      const style = map.getStyle ? map.getStyle() : null;
      const firstLabel = style?.layers?.find((l: any) => l.type === "symbol");
      const beforeId = firstLabel ? firstLabel.id : undefined;

      map.addLayer(
        {
          id: "zips-fill",
          type: "fill",
          source: "zips",
          paint: {
            "fill-color": ["case", ["has", "metricColor"], ["get", "metricColor"], "transparent"],
            "fill-opacity": 0.75,
            "fill-outline-color": "rgba(0,0,0,0.08)",
          },
        },
        beforeId
      );

      console.log("[MapLibreMap] zips source + fill layer added");
    } catch (err) {
      console.error("[MapLibreMap] addSource/addLayer failed", err);
      setError("Failed to add map layers.");
    }
  }, [isMapReady, baseGeoJSON]);

  // Setup interactions (kept as stable callback)
  const setupMapInteractions = useCallback(
    (mapInstance: maplibregl.Map) => {
      if (!mapInstance) return;
      if (interactionsSetup.current) return;

      console.log("[MapLibreMap] setting up interactions...");
      const layers = ["zips-fill"];
      let popup: maplibregl.Popup | null = null;

      // throttled mousemove using requestAnimationFrame
      const mousemoveHandler = (e: any) => {
        lastMouseEventRef.current = e;
        if (mousemoveRafRef.current) return;
        mousemoveRafRef.current = requestAnimationFrame(() => {
          const ev = lastMouseEventRef.current;
          mousemoveRafRef.current = null;
          try {
            const features = ev.features ?? [];
            mapInstance.getCanvas().style.cursor = features.length ? "pointer" : "";
            if (!features.length) {
              popup?.remove();
              return;
            }
            const props = features[0].properties ?? {};
            const zipCode = props.zipCode ?? props.zip?.toString();
            if (!zipCode || !zipData[zipCode]) {
              popup?.remove();
              return;
            }

            const coords =
              features[0].geometry?.type === "Point" ? (features[0].geometry.coordinates as LngLatLike) : ev.lngLat;
            popup?.remove();
            popup = new maplibregl.Popup({ closeButton: false, offset: [0, -10], maxWidth: "320px" })
              .setLngLat(coords)
              .setHTML(getMetricDisplay(zipData[zipCode], selectedMetric))
              .addTo(mapInstance);
          } catch (err) {
            console.error("[MapLibreMap] mousemove handler error", err);
          }
        });
      };

      const mouseleaveHandler = () => {
        try {
          mapInstance.getCanvas().style.cursor = "";
          popup?.remove();
        } catch (err) {
          console.error("[MapLibreMap] mouseleave error", err);
        }
      };

      const clickHandler = (e: any) => {
        try {
          const props = (e.features?.[0]?.properties) ?? {};
          const zipCode = props.zipCode ?? props.zip;
          if (zipCode && zipData[zipCode]) {
            onZipSelect(zipData[zipCode]);
          }
        } catch (err) {
          console.error("[MapLibreMap] click handler error", err);
        }
      };

      // use delegated events on layer
      mapInstance.on("mousemove", layers, mousemoveHandler);
      mapInstance.on("mouseleave", layers, mouseleaveHandler);
      mapInstance.on("click", layers, clickHandler);

      // cleanup when removing interactions (we rely on map removal to clear listeners)
      interactionsSetup.current = true;
      console.log("[MapLibreMap] interactions registered");
    },
    [onZipSelect, selectedMetric, zipData]
  );

  // Re-run process/update when data changes (ensures source exists)
  useEffect(() => {
  if (!isMapReady || !mapRef.current || !baseGeoJSON || Object.keys(zipData).length === 0) return;
  if (processingRef.current) return;
  
  console.log('[MapLibreMap] Processing data update for metric:', selectedMetric);
  processingRef.current = true;

  // cancel previous worker task
  if (abortControllerRef.current) abortControllerRef.current.abort();
  abortControllerRef.current = new AbortController();
  const signal = abortControllerRef.current.signal;

  (async () => {
    try {
      const map = mapRef.current;
      if (!map) return;
      // get current viewport bbox
      const bounds = map.getBounds();
      const viewport = {
        minX: bounds.getWest(),
        minY: bounds.getSouth(),
        maxX: bounds.getEast(),
        maxY: bounds.getNorth(),
      };
      console.log('[MapLibreMap] Current viewport:', viewport);

      // send geojson + viewport to worker
      console.log('[MapLibreMap] Sending data to worker for processing');
      const processed = await processData({
        type: "PROCESS_GEOJSON",
        data: { geojson: baseGeoJSON, zipData, selectedMetric, viewport },
      });

      if (signal.aborted) {
        console.log('[MapLibreMap] Processing aborted');
        return;
      }

      const source = map.getSource("zips") as maplibregl.GeoJSONSource;
      if (!source) throw new Error("Map source 'zips' missing");

      console.log(`[MapLibreMap] Updating map with ${processed.features?.length || 0} features`);
      // set filtered features
      source.setData({
        type: "FeatureCollection",
        features: processed.features ?? [],
      });

      // apply bucketed Mapbox expression for fill-color
      if (processed.bucketExpression) {
        console.log('[MapLibreMap] Applying color expression to map');
        map.setPaintProperty("zips-fill", "fill-color", processed.bucketExpression);
      }

      if (!interactionsSetup.current) {
        console.log('[MapLibreMap] Setting up map interactions');
        setupMapInteractions(map);
      }
      console.log('[MapLibreMap] Map update complete');
    } catch (err) {
      if (!signal.aborted) console.error("[MapLibreMap] update failed", err);
    } finally {
      processingRef.current = false;
    }
  })();

  return () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };
}, [isMapReady, baseGeoJSON, zipData, selectedMetric, processData, setupMapInteractions]);

  // When searchZip arrives, fly to it if valid coords
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !searchZip || !zipData[searchZip]) return;
    const { longitude, latitude } = zipData[searchZip];
    if (typeof longitude !== "number" || typeof latitude !== "number") {
      console.warn("[MapLibreMap] searchZip coords invalid", searchZip, zipData[searchZip]);
      return;
    }
    try {
      console.log(`[MapLibreMap] flying to ZIP ${searchZip}`);
      mapRef.current.flyTo({ center: [longitude, latitude], zoom: 10, duration: 1200 });
    } catch (err) {
      console.error("[MapLibreMap] flyTo failed", err);
    }
  }, [isMapReady, searchZip, zipData]);

  return (
    <div className="absolute inset-0 w-full h-full min-h-[400px]">
      <div
        ref={mapContainer}
        data-testid="map-container"
        role="application"
        className="w-full h-full"
        style={{ minHeight: "400px" }}
      />
      {(isLoading || !isMapReady || error) && (
        <div
          role="status"
          aria-label="Loading..."
          className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10"
        >
          {error ? (
            <div className="text-center space-y-4">
              <div className="text-red-500 font-bold">{error}</div>
              <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded">
                Refresh Page
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div
                role="progressbar"
                aria-label="Loading map data"
                className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"
              />
              <p className="text-sm font-medium text-gray-700">{progress.phase || "Loading"}...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
