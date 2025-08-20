import maplibregl from "maplibre-gl";

// Carto Positron styles - we'll use these to create the layered approach
const CARTO_POSITRON_BASE =
  "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json";
const CARTO_POSITRON_LABELS =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

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
  map.addControl(
    new maplibregl.NavigationControl({ visualizePitch: false }),
    "top-right"
  );
  map.addControl(
    new maplibregl.AttributionControl({
      customAttribution: "© <a href='https://carto.com/attributions'>CARTO</a>",
      compact: true,
    }),
    "bottom-left"
  );

  // Error listener
  map.on("error", (e) => console.warn("[Map error]", e && (e.error || e)));

  // Load callback
  map.on("load", async () => {
    console.log("[Map] glyphs:", map.getStyle()?.glyphs);
    console.log("[Map] has zips source:", Boolean(map.getSource("zips")));

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
            "fill-color": [
              "case",
              ["has", "metricValue"],
              ["get", "metricColor"],
              "#e0e0e0",
            ],
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
            "circle-color": [
              "case",
              ["has", "metricValue"],
              ["get", "metricColor"],
              "#e0e0e0",
            ],
            "circle-radius": 5,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      /* Load and add Carto Positron labels layer on top (safe version) */
      const labelsResponse = await fetch(CARTO_POSITRON_LABELS);
      if (labelsResponse.ok) {
        const labelsStyle = await labelsResponse.json();

        const currentGlyphs = map.getStyle()?.glyphs;
        const canAddSymbols = Boolean(currentGlyphs || labelsStyle.glyphs);

        const byId: Record<string, any> = {};
        for (const lyr of labelsStyle.layers) byId[lyr.id] = lyr;

        const pick = (lyr: any) =>
          lyr.type === "symbol" ||
          (lyr.type === "line" &&
            (lyr.id.includes("boundary") || lyr.id.includes("admin")));

        for (const raw of labelsStyle.layers) {
          if (!pick(raw)) continue;

          // Add source if missing
          if (raw.source && !map.getSource(raw.source)) {
            const srcDef = labelsStyle.sources[raw.source];
            if (srcDef) map.addSource(raw.source, srcDef);
          }

          let layer = { ...raw };
          if (layer.ref) {
            const base = byId[layer.ref];
            if (!base) continue;
            layer = {
              ...base,
              id: raw.id,
              type: raw.type ?? base.type,
              source: raw.source ?? base.source,
              ["source-layer"]: raw["source-layer"] ?? base["source-layer"],
              layout: { ...(base.layout || {}), ...(raw.layout || {}) },
              paint: { ...(base.paint || {}), ...(raw.paint || {}) },
              filter: raw.filter ?? base.filter,
            };
            delete layer.ref;
          }

          if (layer.type === "symbol" && !canAddSymbols) continue;

          const newId = `labels-${layer.id}`;
          if (map.getLayer(newId)) continue;

          const finalLayer = { ...layer, id: newId };
          map.addLayer(finalLayer);
        }
      }
    } catch (error) {
      console.warn("Failed to load label layers:", error);
    }
  });

  return map;
}
