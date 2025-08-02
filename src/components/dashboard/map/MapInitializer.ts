import maplibregl from "maplibre-gl";

// Carto Positron styles - we'll use these to create the layered approach
const CARTO_POSITRON_BASE = "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json";
const CARTO_POSITRON_LABELS = "https://basemaps.cartocdn.com/gl/positron-labels-gl-style/style.json";

export function createMap(container: HTMLElement): maplibregl.Map {
  const map = new maplibregl.Map({
    container,
    style: CARTO_POSITRON_BASE, // Start with no-labels base
    center: [-98.5795, 39.8283],
    zoom: 5,
    minZoom: 3,
    maxZoom: 12,
    maxBounds: [
      [-180, -85],
      [180, 85],
    ],
    attributionControl: false,
  });

  /* Controls */
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
  map.addControl(
    new maplibregl.AttributionControl({
      customAttribution: "© <a href='https://carto.com/attributions'>CARTO</a>",
      compact: true,
    }),
    "bottom-left",
  );

  map.on("load", async () => {
    try {
      /* Register empty ZIP source */
      if (!map.getSource("zips")) {
        map.addSource("zips", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      /* Add ZIP choropleth layers (fill + border) */
      if (!map.getLayer("zips-fill")) {
        map.addLayer({
          id: "zips-fill",
          type: "fill",
          source: "zips",
          paint: {
            "fill-color": ["case", ["has", "metricValue"], ["get", "metricColor"], "#e0e0e0"],
            "fill-opacity": 0.7,
          },
        });
        
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
        
        map.addLayer({
          id: "zips-points",
          type: "circle",
          source: "zips",
          filter: ["all", ["==", ["geometry-type"], "Point"]],
          minzoom: 8,
          paint: {
            "circle-color": ["case", ["has", "metricValue"], ["get", "metricColor"], "#e0e0e0"],
            "circle-radius": 5,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      /* Load and add Carto Positron labels layer on top */
      const labelsResponse = await fetch(CARTO_POSITRON_LABELS);
      if (labelsResponse.ok) {
        const labelsStyle = await labelsResponse.json();
        
        // Add only label and state boundary layers from the labels style
        labelsStyle.layers.forEach((layer: any) => {
          if (layer.type === "symbol" || 
              (layer.type === "line" && layer.id.includes("boundary")) ||
              (layer.type === "line" && layer.id.includes("admin"))) {
            
            // Add source if it doesn't exist
            if (layer.source && !map.getSource(layer.source)) {
              const source = labelsStyle.sources[layer.source];
              if (source) {
                map.addSource(layer.source, source);
              }
            }
            
            // Add layer if it doesn't exist
            if (!map.getLayer(layer.id)) {
              map.addLayer({
                ...layer,
                id: `labels-${layer.id}`, // Prefix to avoid conflicts
              });
            }
          }
        });
      }
    } catch (error) {
      console.warn("Failed to load label layers:", error);
      // Continue with base functionality even if labels fail
    }
  });

  return map;
}