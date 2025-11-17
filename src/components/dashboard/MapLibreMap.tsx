import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import maplibregl, { LngLatLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { scaleLinear } from "d3-scale";
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
  colorScaleDomain,
  isLoading,
  progress,
  processData,
}: MapProps) {
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
      maxBounds: [-180, -90, 180, 90],
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

  /* Color scale - defensive: ensure domain sorted */
  const colorScale = useMemo(() => {
    if (!colorScaleDomain) return null;
    const [a, b] = colorScaleDomain;
    const domain = a <= b ? [a, b] : [b, a];
    return scaleLinear<string>().domain(domain).range(["#FFF9B0", "#E84C61", "#2E0B59"]).clamp(true);
  }, [colorScaleDomain]);

  // Load base GeoJSON (safe fetch + decompress with pako)
  useEffect(() => {
    if (!isMapReady || baseGeoJSON) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    (async () => {
      try {
        const geoJsonUrl = new URL(`${BASE_PATH}data/us-zip-codes.geojson.gz`, window.location.origin).href;
        console.log("[MapLibreMap] fetching base geojson...", geoJsonUrl);
        const resp = await fetch(geoJsonUrl, { signal: controller.signal, headers: { Accept: "application/octet-stream" } });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        }

        const contentLength = resp.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
          throw new Error("GeoJSON over 50MB; aborting.");
        }

        const buf = await resp.arrayBuffer();
        const { inflate } = await import("pako");
        const jsonStr = inflate(buf, { to: "string" });
        const parsed = JSON.parse(jsonStr);

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
    if (
      !isMapReady ||
      !mapRef.current?.isStyleLoaded() ||
      !baseGeoJSON ||
      !colorScale ||
      Object.keys(zipData).length === 0
    )
      return;

    if (processingRef.current) return;
    processingRef.current = true;
    abortControllerRef.current = new AbortController();

    (async () => {
      try {
        setError(null);

        // processData is external — pass a copy of what we can
        // If processData supports cancellation, consider accepting a signal.
        const processed = await processData({
          type: "PROCESS_GEOJSON",
          data: { geojson: baseGeoJSON, zipData, selectedMetric },
        });

        if (abortControllerRef.current?.signal.aborted) {
          console.log("[MapLibreMap] process aborted early");
          return;
        }

        const enhancedFeatures = (processed?.features ?? []).map((feature: any) => {
          const props = feature.properties ?? {};
          const value = typeof props.metricValue === "number" ? props.metricValue : undefined;
          if (typeof value === "number" && value > 0) {
            // attach color
            props.metricColor = colorScale(value);
            feature.properties = props;
          }
          return feature;
        });

        const source = mapRef.current!.getSource("zips") as any;
        if (!source) {
          console.error("[MapLibreMap] source 'zips' missing");
          setError("Map data source missing");
          return;
        }

        // setData - put a FeatureCollection
        source.setData({ type: "FeatureCollection", features: enhancedFeatures });

        // only setup interactions once
        if (!interactionsSetup.current && mapRef.current) {
          setupMapInteractions(mapRef.current);
        }
      } catch (err) {
        if (!abortControllerRef.current?.signal.aborted) {
          console.error("[MapLibreMap] update failed", err);
          setError("Failed to update map visualization.");
        }
      } finally {
        processingRef.current = false;
      }
    })();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapReady, baseGeoJSON, colorScale, zipData, selectedMetric, processData]);

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
