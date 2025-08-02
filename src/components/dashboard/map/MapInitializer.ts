import maplibregl from "maplibre-gl";

export function createMap(container: HTMLElement): maplibregl.Map {
  const map = new maplibregl.Map({
    container,
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
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

  map.on("load", () => {
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
          "fill-color": "#ccc",
          "fill-opacity": 0.7,
        },
      });
      map.addLayer({
        id: "zips-border",
        type: "line",
        source: "zips",
        paint: {
          "line-color": "#fff",
          "line-width": 0.5,
        },
      });
      map.addLayer({
        id: "zips-points",
        type: "circle",
        source: "zips",
        filter: ["all", ["==", ["geometry-type"], "Point"]],
        minzoom: 8,
        paint: {
          "circle-color": ["case", ["has", "metricValue"], ["get", "metricColor"], "#ccc"],
          "circle-radius": 5,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff",
        },
      });
    }

    /* Ensure ordering:
       - ZIP fill under labels and roads
       - State boundary on top of ZIP fill
    */
    const style = map.getStyle();

    // Move built-in state boundary (`boundary_state`) above zips
    if (style.layers.find((l) => l.id === "boundary_state")) {
      map.moveLayer("boundary_state", "zips-border");
    }

    // Move labels above ZIP fill (all symbol layers)
    style.layers.forEach((layer) => {
      if (layer.type === "symbol" && map.getLayer(layer.id)) {
        map.moveLayer(layer.id);
      }
    });
  });

  return map;
}