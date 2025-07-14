import maplibregl from "maplibre-gl";

// MapLibre GL JS map initialization utility
// This is now primarily for reference - actual maps are created directly in components

export const createMapLibreMap = (container: HTMLElement): maplibregl.Map => {
  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: {
        "carto-light": {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
            "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
            "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
            "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          ],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: {
            "background-color": "#f8f9fa",
          },
        },
        {
          id: "carto-light-layer",
          type: "raster",
          source: "carto-light",
          minzoom: 0,
          maxzoom: 18,
        },
      ],
    },
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

  // Add navigation control
  map.addControl(new maplibregl.NavigationControl(), "top-right");

  return map;
};

// Legacy export for backward compatibility (deprecated)
export const createMap = createMapLibreMap;
