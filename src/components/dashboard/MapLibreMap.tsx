import { useEffect, useRef, useState, useMemo } from "react";
import maplibregl, { LngLatLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { scaleLinear } from "d3-scale";
import { getMetricDisplay } from "./map/utils";
import { ZipData } from "./map/types";

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

  const createAndInitializeMap = (container: HTMLDivElement): maplibregl.Map => {
    const map = new maplibregl.Map({
      container,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [-98.5795, 39.8283],
      zoom: 3.5,
      minZoom: 3,
      maxZoom: 12,
    });

    map.on("error", (e) => {
      console.error("[Map] Internal error:", e?.error);
      setError("Map encountered an internal error. Please refresh the page.");
    });

    map.once("load", () => {
      console.log("[Map] Loaded successfully");
      map.resize();
      setIsMapReady(true);

      // Reposition labels using moveLayer
      const labelLayers = [
        "Place labels",
        "Road labels",
        "POI labels",
        "Housenumber labels",
      ];

      labelLayers.forEach((layerId) => {
        const layer = map.getLayer(layerId);
        if (layer) {
          try {
            map.moveLayer(layerId);
          } catch (err) {
            console.warn(`Could not move layer ${layerId}:`, err);
          }
        }
      });
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    return map;
  };

  // Initialize map with enhanced error handling
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const { clientWidth, clientHeight } = mapContainer.current;
    
    if (!clientWidth || !clientHeight) {
      console.warn("Container has no size yet; delaying init");
      const id = requestAnimationFrame(() => {
        if (mapContainer.current && !mapRef.current) {
          const newMap = createAndInitializeMap(mapContainer.current);
          mapRef.current = newMap;
        }
      });
      return () => cancelAnimationFrame(id);
    }

    try {
      const newMap = createAndInitializeMap(mapContainer.current);
      mapRef.current = newMap;

      return () => {
        if (newMap) {
          try {
            newMap.remove();
          } catch (error) {
            console.error("[MapLibreMap] Error during cleanup:", error);
          }
        }
      };
    } catch (error) {
      console.error("[MapLibreMap] Failed to initialize map:", error);
      setError("Failed to initialize map. Please refresh the page.");
    }
  }, []);
  
  /* Color scale */
  const colorScale = useMemo(() => {
    if (!colorScaleDomain || colorScaleDomain.length < 2) return null;
    return scaleLinear<string>()
      .domain(colorScaleDomain)
      .range(["#FFF9B0", "#E84C61", "#2E0B59"])
      .clamp(true);
  }, [colorScaleDomain]);

  // Load base GeoJSON data with enhanced security
  useEffect(() => {
    if (!isMapReady || baseGeoJSON) return;

    async function loadGeoJSON() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn("[MapLibreMap] GeoJSON load timeout");
        controller.abort();
      }, 30000); // 30 second timeout for large file

      try {
        console.log("[MapLibreMap] Loading base GeoJSON...");
        const response = await fetch("/data/us-zip-codes.geojson.gz", {
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

        // Check file size
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
        
        // Basic validation
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

  // Process and update map data with enhanced error handling
  useEffect(() => {
    if (!isMapReady || !baseGeoJSON || !colorScale || Object.keys(zipData).length === 0) return;

    const controller = new AbortController();
    console.log("[MapLibreMap] Processing zip data for map update...");

    (async () => {
      try {
        setError(null);
        console.log("[MapLibreMap] Starting data processing...");
        
        const processed = await processData({
          type: "PROCESS_GEOJSON",
          data: { geojson: baseGeoJSON, zipData, selectedMetric },
        });
        
        if (controller.signal.aborted) {
          console.log("[MapLibreMap] Data processing aborted");
          return;
        }

        if (!mapRef.current?.isStyleLoaded()) {
          console.warn("[MapLibreMap] Map style not loaded, skipping update");
          return;
        }

        console.log(`[MapLibreMap] Processing ${processed.features?.length || 0} features for visualization...`);

        // Add color information to features with validation
        const enhancedFeatures = processed.features.map((feature: any) => {
          if (feature.properties?.metricValue && 
              typeof feature.properties.metricValue === 'number' && 
              feature.properties.metricValue > 0) {
            feature.properties.metricColor = colorScale(feature.properties.metricValue);
          }
          return feature;
        });

        console.log("[MapLibreMap] Updating map source with processed data...");
        const source = mapRef.current.getSource("zips") as maplibregl.GeoJSONSource;
        if (source) {
          source.setData({ 
            type: "FeatureCollection", 
            features: enhancedFeatures 
          });
          console.log("[MapLibreMap] Map source updated successfully");
        } else {
          console.error("[MapLibreMap] ZIP source not found on map");
          setError("Map data source not available");
          return;
        }

        // Setup interactions once with error handling
        if (!interactionsSetup.current) {
          try {
            setupMapInteractions(mapRef.current);
            interactionsSetup.current = true;
            console.log("[MapLibreMap] Map interactions setup completed");
          } catch (interactionError) {
            console.error("[MapLibreMap] Failed to setup map interactions:", interactionError);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("[MapLibreMap] Failed to update map layers:", err);
          setError("Failed to update map visualization. Please try refreshing.");
        }
      }
    })();

    return () => {
      console.log("[MapLibreMap] Aborting data processing...");
      controller.abort();
    };
  }, [isMapReady, baseGeoJSON, colorScale, zipData, selectedMetric, processData]);

  // Navigate to searched ZIP with error handling
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

  // Setup map interactions with comprehensive error handling
  const setupMapInteractions = (mapInstance: maplibregl.Map) => {
    console.log("[MapLibreMap] Setting up map interactions...");
    let popup: maplibregl.Popup | null = null;
    const layers = ["zips-fill"];

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
            console.log(`[MapLibreMap] ZIP selected: ${props.zipCode}`);
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
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainer} data-testid="map-container" role="application" className="w-full h-full" />
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
