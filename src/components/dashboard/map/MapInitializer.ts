import maplibregl from "maplibre-gl";

/** Build a MapLibre‑GL map that feels like the original Leaflet setup. */
export function createMapLibreMap(container: HTMLElement): maplibregl.Map {
  /* ---------- core map ---------- */
  const map = new maplibregl.Map({
    container,
    center: [-98.5795, 39.8283],
    zoom: 5,
    minZoom: 3,
    maxZoom: 12,
    maxBounds: [
      [-180, -85],
      [180, 85],
    ],
    attributionControl: false,        // we’ll add a custom one below
    style: {
      version: 8,
      sources: {
        // base raster tiles (no labels)
        "carto-light": {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
            "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
            "https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
            "https://d.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
          ],
          tileSize: 256,
        },
        // labels – separate layer so pointer events pass through
        "carto-light-labels": {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
            "https://b.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
            "https://c.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
            "https://d.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
          ],
          tileSize: 256,
        },
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": "#f8f9fa" } },
        {
          id: "carto-light-layer",
          type: "raster",
          source: "carto-light",
          minzoom: 0,
          maxzoom: 18,
        },
        // labels on top of everything
        {
          id: "carto-light-labels-layer",
          type: "raster",
          source: "carto-light-labels",
          minzoom: 0,
          maxzoom: 18,
        },
      ],
    },
  });

  /* ---------- controls ---------- */
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
  map.addControl(
    new maplibregl.AttributionControl({
      customAttribution: "© <a href='https://carto.com/attributions'>CARTO</a>",
      compact: true,
    }),
    "bottom-left",
  );

  
  map.scrollZoom.setWheelZoomRate(0.5);

  // zoomSnap: round live zoom to nearest step when wheel / trackpad stops
  const SNAP = 0.25;
  let targetZoom = map.getZoom();
  function applySnap() {
    const raw = map.getZoom();
    // don’t quantise while actively zooming (keeps smooth pinch)
    if (!map.isMoving() && Math.abs(raw - targetZoom) > 1e-6) {
      targetZoom = Math.round(raw / SNAP) * SNAP;
      map.zoomTo(targetZoom, { duration: 0 });
    }
  }
  map.on("moveend", applySnap);
  map.on("wheel", () => {
    // debounce – snap after scroll inertia ends
    clearTimeout((applySnap as any)._t);
    (applySnap as any)._t = setTimeout(applySnap, 80);
  });

  return map;
}

/* optional: legacy re‑export so imports stay unchanged */
export const createMap = createMapLibreMap;
