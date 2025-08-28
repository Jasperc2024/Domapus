import maplibregl from "maplibre-gl";

// MapTiler Basic Light style
const MAPTILER_BASIC_LIGHT = "https://api.maptiler.com/maps/basic-v2-light/style.json?key=jp8Rob4zHWmMhtCP3kyX";

// Security and performance constants
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Style cache to avoid repeated fetching
const styleCache = new Map<string, any>();

// Utility function for secure fetch with validation
async function secureFetch(url: string, retryCount = 0): Promise<any> {
  console.log(`[MapInit] Starting secure fetch for: ${url} (attempt ${retryCount + 1})`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[MapInit] Request timeout for: ${url}`);
    controller.abort();
  }, REQUEST_TIMEOUT);

  try {
    // Check cache first
    if (styleCache.has(url)) {
      console.log(`[MapInit] Using cached style for: ${url}`);
      clearTimeout(timeoutId);
      return styleCache.get(url);
    }

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'max-age=3600'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check response size
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      throw new Error(`Response too large: ${contentLength} bytes`);
    }

    const data = await response.json();
    
    // Basic JSON structure validation
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON structure received');
    }

    // Cache the result
    styleCache.set(url, data);
    console.log(`[MapInit] Successfully fetched and cached style: ${url}`);
    
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[MapInit] Fetch error for ${url}:`, error);
    
    if (retryCount < MAX_RETRIES && !(error instanceof TypeError && error.message.includes('aborted'))) {
      console.log(`[MapInit] Retrying fetch for ${url} in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return secureFetch(url, retryCount + 1);
    }
    
    throw error;
  }
}

export function createMap(container: HTMLElement): maplibregl.Map {
  console.log('[MapInit] Creating new map instance...');
  
  const map = new maplibregl.Map({
    container,
    style: MAPTILER_BASIC_LIGHT, // MapTiler Basic Light style
    center: [-98.5795, 39.8283],
    zoom: 5,
    minZoom: 3,
    maxZoom: 12,
    maxBounds: [
      [-180, -85],
      [180, 85],
    ],
    attributionControl: false
  });

  map.on("error", e => console.error("MapLibre internal error:", e.error));
  console.log('[MapInit] Map instance created successfully');

  /* Controls */
  try {
    console.log('[MapInit] Adding navigation controls...');
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: false }),
      "top-right"
    );
    
    console.log('[MapInit] Adding attribution controls...');
    map.addControl(
      new maplibregl.AttributionControl({
        customAttribution: "© <a href='https://www.maptiler.com/copyright/'>MapTiler</a> © <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
        compact: true,
      }),
      "bottom-left"
    );
    console.log('[MapInit] Controls added successfully');
  } catch (error) {
    console.error('[MapInit] Error adding controls:', error);
  }

  // Enhanced error listener with detailed logging
  map.on("error", (e) => {
    console.error("[MapInit] Map error occurred:", {
      error: e?.error || e,
      type: e?.type,
      target: e?.target,
      timestamp: new Date().toISOString()
    });
  });

  // Enhanced load callback with comprehensive error handling
  map.on("load", async () => {
    console.log("[MapInit] Map load event triggered");
    console.log("[MapInit] Map style loaded, glyphs:", map.getStyle()?.glyphs);
    console.log("[MapInit] Checking existing sources:", Object.keys(map.getStyle()?.sources || {}));

    try {
      /* Register empty ZIP source with validation */
      console.log("[MapInit] Setting up ZIP data source...");
      if (!map.getSource("zips")) {
        map.addSource("zips", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          buffer: 0,
          maxzoom: 12,
          tolerance: 0.375
        });
        console.log("[MapInit] ZIP source added successfully");
      } else {
        console.log("[MapInit] ZIP source already exists");
      }

      /* Add ZIP choropleth layers (fill + border) with error handling */
      console.log("[MapInit] Adding ZIP visualization layers...");
      
      // Add layers individually to avoid type issues
      if (!map.getLayer("zips-fill")) {
        map.addLayer({
          id: "zips-fill",
          type: "fill",
          source: "zips",
          paint: {
            "fill-color": [
              "case",
              ["has", "metricValue"],
              ["get", "metricColor"],
              "#e0e0e0",
            ] as any,
            "fill-opacity": 0.7,
          },
        });
        console.log("[MapInit] Added layer: zips-fill");
      }

      if (!map.getLayer("zips-border")) {
        map.addLayer({
          id: "zips-border",
          type: "line",
          source: "zips",
          paint: {
            "line-color": "#ffffff",
            "line-width": 0.5,
            "line-opacity": 0.8,
          },
        });
        console.log("[MapInit] Added layer: zips-border");
      }

      if (!map.getLayer("zips-points")) {
        map.addLayer({
          id: "zips-points",
          type: "circle",
          source: "zips",
          filter: ["all", ["==", ["geometry-type"], "Point"]],
          minzoom: 8,
          paint: {
            "circle-color": [
              "case",
              ["has", "metricValue"],
              ["get", "metricColor"],
              "#e0e0e0",
            ] as any,
            "circle-radius": 5,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
          },
        });
        console.log("[MapInit] Added layer: zips-points");
      }


      /* Reposition MapTiler label layers to be on top of choropleth */
      console.log("[MapInit] Repositioning MapTiler label layers on top...");
      
      try {
        const maptilerStyle = await secureFetch(MAPTILER_BASIC_LIGHT);
        console.log("[MapInit] MapTiler style reloaded for label processing...");

        if (maptilerStyle?.layers) {
          // Filter for label/text layers that should be on top of our choropleth
          const labelLayers = maptilerStyle.layers.filter((layer: any) => 
            layer.type === 'symbol' && 
            layer.layout && 
            (layer.layout['text-field'] || layer.layout['icon-image']) &&
            (layer.id.includes('label') || 
             layer.id.includes('text') || 
             layer.id.includes('place') ||
             layer.id.includes('poi') ||
             layer.id.includes('name'))
          );
          
          console.log(`[MapInit] Found ${labelLayers.length} label layers to reposition...`);
          
          let repositioned = 0;
          
          // Remove and re-add label layers to put them on top
          for (const layer of labelLayers) {
            try {
              if (map.getLayer(layer.id)) {
                console.log(`[MapInit] Repositioning label layer: ${layer.id}`);
                
                // Store layer definition
                const layerDef = map.getLayer(layer.id);
                
                // Remove and re-add to move to top
                map.removeLayer(layer.id);
                map.addLayer(layerDef as any);
                
                repositioned++;
              }
            } catch (layerError) {
              console.warn(`[MapInit] Failed to reposition layer ${layer.id}:`, layerError);
            }
          }
          
          console.log(`[MapInit] ✓ Repositioned ${repositioned} label layers on top of choropleth`);
        }
        
        // Clean up cache after processing
        setTimeout(() => {
          styleCache.clear();
          console.log("[MapInit] Style cache cleared");
        }, 5000);

      } catch (error) {
        console.warn("[MapInit] ⚠️ Failed to reposition label layers, continuing:", error);
      }
    } catch (error) {
      console.error("[MapInit] Critical error in map setup:", error);
      // Re-throw critical errors that should stop map initialization
      throw error;
    }
  });

  // Add cleanup handlers for memory management
  const cleanup = () => {
    console.log("[MapInit] Cleaning up map resources...");
    styleCache.clear();
    if (map && map.remove) {
      try {
        map.remove();
        console.log("[MapInit] Map instance removed successfully");
      } catch (error) {
        console.error("[MapInit] Error removing map:", error);
      }
    }
  };

  // Store cleanup function on map for external access
  (map as any)._cleanup = cleanup;

  console.log("[MapInit] Map initialization complete");
  return map;
}

// Export cleanup function for external use
export function cleanupMap(map: maplibregl.Map) {
  if ((map as any)._cleanup) {
    (map as any)._cleanup();
  }
}
