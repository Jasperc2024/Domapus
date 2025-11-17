import { useEffect, useRef, useState, useMemo } from "react";
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
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const interactionsSetup = useRef(false);
  const [baseGeoJSON, setBaseGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const processingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const createAndInitializeMap = (container: HTMLDivElement): maplibregl.Map => {
    const map = new maplibregl.Map({
      container,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [-98.57, 39.82],
      zoom: 3.5,
      minZoom: 3,
      maxZoom: 12,
    });

    map.on("error", (e) => {
      console.error("[Map] Internal error:", e?.error);
      setError("Map encountered an internal error. Please refresh the page.");
    });

    map.on("styledata", () => {
      if (map.isStyleLoaded()) {
        console.log("[Map] Style fully loaded");
        setIsMapReady(true);
      }
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    return map;
  };

  // Initialize map with enhanced error handling and cleanup
  useEffect(() => {
    if (!mapContainer.current) {
      console.error("Map container ref is not available.");
      return;
    }
    if (mapRef.current) {
      return; // Map is already initialized
    }

    let map: maplibregl.Map | null = null;
    let animationFrameId: number;

    const init = () => {
      if (!mapContainer.current) return; // Container unmounted

      const { clientWidth, clientHeight } = mapContainer.current;

      // If container has no size, try again next frame
      if (clientWidth === 0 || clientHeight === 0) {
        console.warn("Container has no size, delaying init...");
        animationFrameId = requestAnimationFrame(init);
        return;
      }

      // Container has size, create the map
      try {
        console.log("[MapLibreMap] Container is sized, initializing map...");
        map = createAndInitializeMap(mapContainer.current);
        mapRef.current = map;
      } catch (error) {
        console.error("[MapLibreMap] Failed to initialize map:", error);
        setError("Failed to initialize map. Please refresh the page.");
      }
    };

    // Start the initialization attempt
    animationFrameId = requestAnimationFrame(init);

    // This single cleanup function handles all cases
    return () => {
      console.log("[MapLibreMap] Cleanup running...");
      cancelAnimationFrame(animationFrameId); // Stop any pending init
      
      // Use mapRef.current first, as it's the most reliable
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      } else if (map) {
        // Fallback in case ref hadn't been set yet
        map.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  /* Color scale */
  const colorScale = useMemo(() => {
    if (!colorScaleDomain || colorScaleDomain.length < 2) return null;
    return scaleLinear<string>()
      .domain(colorScaleDomain)
      .range(["#FFF9B0", "#E84C61", "#2E0B59"])
      .clamp(true);
  }, [colorScaleDomain]);

  // Load base GeoJSON data
  useEffect(() => {
    if (!isMapReady || baseGeoJSON) return; // Only load once

    async function loadGeoJSON() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn("[MapLibreMap] GeoJSON load timeout");
        controller.abort();
      }, 30000); // 30 second timeout

      try {
        const geoJsonUrl = new URL( `${BASE_PATH}data/us-zip-codes.geojson.gz`, window.location.origin).href;
        console.log('[MapLibreMap] Loading base GeoJSON...');
        const response = await fetch(geoJsonUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/octet-stream',
            'Cache-Control': 'max-age=86400' // Cache for 24 hours
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Failed to load GeoJSON: ${response.status} ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB limit
          throw new Error(`GeoJSON file too large: ${contentLength} bytes`);
        }
        
        console.log("[MapLibreMap] GeoJSON response received, decompressing...");
        const gzipData = await response.arrayBuffer();
        const { inflate } = await import('pako');
        const jsonData = inflate(gzipData, { to: "string" });
        
        console.log("[MapLibreMap] Parsing GeoJSON...");
        const geoJSON = JSON.parse(jsonData);
        
        if (!geoJSON || geoJSON.type !== "FeatureCollection" || !Array.isArray(geoJSON.features)) {
          throw new Error("Invalid GeoJSON structure");
        }
        
        console.log(`[MapLibreMap] GeoJSON loaded successfully with ${geoJSON.features.length} features`);
        setBaseGeoJSON(geoJSON);
      } catch (error) {
        clearTimeout(timeoutId);
        console.error("[MapLibreMap] Error loading GeoJSON:", error);
        if (error instanceof Error && error.name === 'AbortError') {
          setError("Map data loading timed out. Please refresh the page.");
        } else {
          setError("Failed to load map data. Please check your connection and refresh.");
        }
      }
    }

    loadGeoJSON();
  }, [isMapReady, baseGeoJSON]);

  // --- NEW EFFECT: Add the data source and layers ---
  // This is the critical missing step. It runs once after the map
  // and the base GeoJSON are both ready.
  useEffect(() => {
    if (!isMapReady || !baseGeoJSON || !mapRef.current) return;

    const map = mapRef.current;

    // Prevent this from running more than once
    if (map.getSource("zips")) {
      console.log("[MapLibreMap] Source and layers already added.");
      return;
    }

    console.log("[MapLibreMap] Adding source and layers for the first time...");

    try {
      // 1. Add the GeoJSON source
      map.addSource("zips", {
        type: "geojson",
        data: baseGeoJSON, // Use the base data
      });

      // 2. Find the ID of the first label layer in the basemap style
      // This is the correct way to put your data *under* the labels
      const styleLayers = map.getStyle().layers;
      const firstLabelLayer = styleLayers.find(
        (layer) => layer.type === "symbol"
      );
      const beforeId = firstLabelLayer ? firstLabelLayer.id : undefined;

      if (!beforeId) {
        console.warn("[MapLibreMap] Could not find a label layer. Adding layer on top.");
      } else {
        console.log(`[MapLibreMap] Inserting layer before: ${beforeId}`);
      }
      
      // 3. Add the fill layer for your choropleth
      map.addLayer({
        id: "zips-fill", // This ID is used in your setupMapInteractions
        type: "fill",
        source: "zips",
        paint: {
          // Use a data-driven expression. The update effect will
          // add the 'metricColor' property.
          "fill-color": [
            "case",
            ["has", "metricColor"], ["get", "metricColor"],
            "transparent" // Default to transparent
          ],
          "fill-opacity": 0.75,
          "fill-outline-color": "rgba(0, 0, 0, 0.1)",
        },
      }, beforeId); // This inserts your layer *under* the labels

      console.log("[MapLibreMap] Source and layers added successfully.");

    } catch (err) {
      console.error("[MapLibreMap] Error adding source/layers:", err);
      setError("Failed to add map data layers.");
    }

  }, [isMapReady, baseGeoJSON]); // This effect runs when the map AND data are ready

  // Process and update map data
  useEffect(() => {
    // This effect now runs *after* the one above has created the source
  if (
    !isMapReady ||
    !mapRef.current?.isStyleLoaded() ||   // ← ADD THIS
    !baseGeoJSON ||
    !colorScale ||
    Object.keys(zipData).length === 0
  ) return;

    if (processingRef.current) return;

    processingRef.current = true;
    abortControllerRef.current = new AbortController();
    
    console.log("[MapLibreMap] Processing zip data for map update...");

    (async () => {
      try {
        setError(null);
        
        const processed = await processData({
          type: "PROCESS_GEOJSON",
          data: { geojson: baseGeoJSON, zipData, selectedMetric },
        });
        
        if (abortControllerRef.current?.signal.aborted) {
          console.log("[MapLibreMap] Processing aborted");
          return;
        }

        const enhancedFeatures = processed.features.map((feature: any) => {
          if (feature.properties?.metricValue && 
              typeof feature.properties.metricValue === 'number' && 
              feature.properties.metricValue > 0) {
            feature.properties.metricColor = colorScale(feature.properties.metricValue);
          }
          return feature;
        });

        // --- This will now succeed ---
        const source = mapRef.current.getSource("zips") as maplibregl.GeoJSONSource;
        if (source) {
          console.log("[MapLibreMap] Updating source data...");
          source.setData({ 
            type: "FeatureCollection", 
            features: enhancedFeatures 
          });
        } else {
          // This should no longer happen
          console.error("[MapLibreMap] ZIP source not found");
          setError("Map data source not available");
          return;
        }

        if (!interactionsSetup.current && mapRef.current) {
          try {
            setupMapInteractions(mapRef.current);
            interactionsSetup.current = true;
          } catch (interactionError) {
            console.error("[MapLibreMap] Failed to setup interactions:", interactionError);
          }
        }
      } catch (err) {
        if (!abortControllerRef.current?.signal.aborted) {
          console.error("[MapLibreMap] Failed to update map:", err);
          setError("Failed to update map visualization");
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
  }, [isMapReady, baseGeoJSON, colorScale, zipData, selectedMetric]);

  // Navigate to searched ZIP
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !searchZip || !zipData[searchZip]) return;
    
    try {
      const { longitude, latitude } = zipData[searchZip];
      if (typeof longitude === 'number' && typeof latitude === 'number') {
        console.log(`[MapLibreMap] Navigating to ZIP ${searchZip} at [${longitude}, ${latitude}]`);
        mapRef.current.flyTo({ 
          center: [longitude, latitude], 
          zoom: 10,
          duration: 2000
        });
      } else {
        console.warn(`[MapLibreMap] Invalid coordinates for ZIP ${searchZip}:`, { longitude, latitude });
      }
    } catch (error) {
      console.error(`[MapLibreMap] Error navigating to ZIP ${searchZip}:`, error);
    }
  }, [isMapReady, searchZip, zipData]);

  // Setup map interactions
  const setupMapInteractions = (mapInstance: maplibregl.Map) => {
    console.log("[MapLibreMap] Setting up map interactions...");
    let popup: maplibregl.Popup | null = null;
    const layers = ["zips-fill"]; // This layer ID now matches the one we created

    try {
      mapInstance.on("mousemove", layers, (e) => {
        try {
          mapInstance.getCanvas().style.cursor = e.features?.length ? "pointer" : "";
          if (e.features?.[0]?.properties?.zipCode) {
            const props = e.features[0].properties;
            const zipCode = props.zipCode;
            
            if (!zipData[zipCode]) {
              console.warn(`[MapLibreMap] No data found for ZIP: ${zipCode}`);
              return;
            }

            const coords =
              e.features[0].geometry.type === "Point"
                ? (e.features[0].geometry.coordinates as LngLatLike)
                : e.lngLat;

            popup?.remove();
            popup = new maplibregl.Popup({ 
              closeButton: false, 
              offset: [0, -10],
              maxWidth: '300px'
            })
              .setLngLat(coords)
              .setHTML(getMetricDisplay(zipData[zipCode], selectedMetric))
              .addTo(mapInstance);
          }
        } catch (error) {
          console.error("[MapLibreMap] Error in mousemove handler:", error);
        }
      });

      mapInstance.on("mouseleave", layers, () => {
        try {
          mapInstance.getCanvas().style.cursor = "";
          popup?.remove();
        } catch (error) {
          console.error("[MapLibreMap] Error in mouseleave handler:", error);
        }
      });

      mapInstance.on("click", layers, (e) => {
        try {
          const props = e.features?.[0]?.properties;
          if (props?.zipCode && zipData[props.zipCode]) {
            console.log(`[MapLibGbreMap] ZIP selected: ${props.zipCode}`);
            onZipSelect(zipData[props.zipCode]);
          }
        } catch (error) {
          console.error("[MapLibreMap] Error in click handler:", error);
        }
      });

      console.log("[MapLibreMap] Map interactions setup successfully");
    } catch (error) {
      console.error("[MapLibreMap] Failed to setup map interactions:", error);
      throw error;
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full min-h-[400px]">
      <div ref={mapContainer} data-testid="map-container" role="application" className="w-full h-full" style={{ minHeight: '400px' }} />
      {(isLoading || !isMapReady || error) && (
        <div
          role="status"
          aria-label="Loading..."
          className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10"
        >
          {error ? (
            <div className="text-center space-y-4">
              <div className="text-red-500 font-bold">{error}</div>
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
              >
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
